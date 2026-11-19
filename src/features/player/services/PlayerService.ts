// PlayerService —— 播放器编排服务（服务层，业务就近）。
//
// 编排权威从旧 PlayerStore 迁出：本模块持有 audioCore + Player 单例，负责
// 「URL 解析（缓存 + 反竞态）→ loadAndPlay → 事件投影 → ended/FM 续歌」全链路，
// 单向写入 usePlayerStore（纯状态容器）与 useQueueStore（队列权威）。
// store 只承载状态，不再持编排；组件命令统一走 `playerService`。
//
// 依赖方向：service → stores / core / data-service / infra（tauri 经 data-service）。

import type { QueueItem } from '@/shared/types/uiModels';
import type { RepeatMode, Track } from '@/shared/types/player';
import {
  AUDIO_QUALITY_OPTIONS,
  NEXT_REPEAT,
  audioQualityLabel,
} from '@/shared/constants/player';
import { songToQueueItem } from '@/shared/utils/mappers';
import { AudioCore } from '@/shared/lib/player-core/audio';
import type { PlayerCoreTrack } from '@/shared/lib/player-core/models/track';
import { Player } from '../core/player';
import type { ContentSource, QueueSnapshot } from '../stores/queueStore';
import { fmPolicy, queuePolicy, useQueueStore } from '../stores/queueStore';
import {
  fetchFm,
  resolveUrl,
  scrobble as scrobblePlay,
  trashFm,
} from './PlayerDataService';
import {
  applyLimitFromSettings,
  cachedLevels,
  invalidate as invalidateAudioCache,
  localUrl as localAudioUrl,
  requestCache as requestAudioCache,
} from './AudioCacheService';
import { usePlayerStore } from '../stores/playerStore';
import { useAuthStore } from '@/features/auth/stores/authStore';
import { usePlayerSettingsStore } from '../stores/playerSettingsStore';
import { toast } from '@/shared/lib/toast';
import { reportError } from '@/shared/utils/error';

/** QueueItem → 库 Track（URL 留空，由 resolver 解析后注入）。 */
function queueItemToCoreTrack(item: QueueItem): PlayerCoreTrack {
  const { track_id, ...rest } = item;
  return { id: String(track_id), src: '', ...rest };
}

// ── URL 解析（缓存 + TTL + 反竞态 seq + 在途去重） ──
/** 播放 URL 带签名：超时后 CDN 会 403，所以缓存必须有寿命（不是永久 Map）。 */
const URL_TTL_MS = 5 * 60 * 1000;
/** 「不可播」负缓存寿命：比正缓存短 —— 登录 / 换音质后同一首可能立刻变可播。 */
const UNAVAILABLE_TTL_MS = 60 * 1000;
/**
 * 内存 URL 缓存条目。
 * - `url == null` = 「不可播」（VIP / 无版权 / 仅试听），是正常业务值而非错误
 * - `local: true` = 本地磁盘缓存命中的 asset URL：没有签名 / 永不过期（不套 TTL）
 * - `level` / `br` = **实际到手**的档位与码率（可能低于请求档位）
 */
type UrlEntry = {
  url: string | null;
  at: number;
  local?: boolean;
  level?: string | null;
  br?: number | null;
};
const lastUrlCache = new Map<string, UrlEntry>();
/** 在途请求：预取与切歌可能同时解析同一首，合并为一次网络请求（键含音质，不跨档位合并）。 */
const inflightUrl = new Map<
  string,
  { gen: number; promise: Promise<string | null> }
>();
/** 缓存代际（按曲目计）：invalidate 时递增，用于丢弃「作废后到达」的在途结果。 */
const urlGeneration = new Map<number, number>();
/**
 * 本会话里「这首歌实际拿到的档位」。
 *
 * 服务端降级是**按账号 + 曲目**的稳定事实（非 VIP 选无损 → 永远是 exhigh），记下来后
 * 第二次起播就不再白打一次网络（直接拿该档位的本地文件）。换音质 / 换账号时清空重学。
 */
const grantedLevels = new Map<number, string>();

/** 档位高低序（未知档位 / 旧的 `default` 文件算最低）。 */
const QUALITY_RANK = new Map<string, number>(
  AUDIO_QUALITY_OPTIONS.map((option, index) => [option.value, index]),
);

/** 当前**请求**的音质档位（设置项 `player.audioQuality`，即 NCM 的 `level` 参数）。 */
function requestedQuality(): string {
  return usePlayerSettingsStore.getState().player.audioQuality;
}

/**
 * URL 缓存键：同一首的不同音质是不同地址（签名里带档位），必须分开存。
 * 用请求档位（而非实际档位）：本地命中要在网络解析之前发生，那时还不知道实际档位。
 */
function urlKey(trackId: number, quality: string): string {
  return `${trackId}:${quality}`;
}

/** 当前档位下该曲目已解析到的条目（音质徽标 / 码率展示用）。 */
function resolvedEntry(trackId: number): UrlEntry | undefined {
  return lastUrlCache.get(urlKey(trackId, requestedQuality()));
}

/** 回填 URL 缓存（仅当该曲目还没被 invalidate / 重新切歌作废）。 */
function remember(
  key: string,
  trackId: number,
  gen: number,
  entry: UrlEntry,
): void {
  if ((urlGeneration.get(trackId) ?? 0) !== gen) return;
  lastUrlCache.set(key, entry);
}

/** 已缓存的本地变体里挑最高档（离线兜底用；`default` 等未知档位排最后）。 */
async function bestCachedLevel(trackId: number): Promise<string | null> {
  const levels = await cachedLevels(trackId);
  if (levels.length === 0) return null;
  return levels.reduce((best, level) =>
    (QUALITY_RANK.get(level) ?? -1) > (QUALITY_RANK.get(best) ?? -1)
      ? level
      : best,
  );
}

/** 已提示过的「请求 → 实际」组合：每会话每种组合只提示一次，避免逐首刷屏。 */
const downgradeNotified = new Set<string>();

/**
 * 实际档位低于请求档位 → 提示一次（之前是静默降级，用户会以为设置没生效）。
 *
 * 发生场景：非 VIP 选无损 / Hi-Res / 母带、未登录只能拿标准档、某首歌本身没有更高档。
 * **不阻断播放** —— 降级是正常业务值，能出声就比失败好。
 */
function notifyDowngrade(granted: string | null | undefined): void {
  const requested = requestedQuality();
  if (!granted || granted === requested) return;
  const id = `${requested}>${granted}`;
  if (downgradeNotified.has(id)) return;
  downgradeNotified.add(id);
  toast.info(
    `已按「${audioQualityLabel(granted)}」播放（当前无法提供「${audioQualityLabel(
      requested,
    )}」）`,
    { id: 'quality-downgrade' },
  );
}
let playSeq = 0;
/** FM 续歌防死循环上限（对齐旧实现）。 */
const FM_CONTINUE_MAX = 8;
/** FM 取数重试（对齐 YesPlayMusic：多次 + 线性退避），全部失败才提示并停。 */
const FM_FETCH_ATTEMPTS = 3;
const FM_FETCH_BACKOFF_MS = 800;
/** 网络类失败上限：达到即停，避免断网时无限跳歌空转。 */
const MAX_FAILED_STREAK = 5;
/** 「不可播」跳过上限：队列里可能成片出现 VIP / 无版权曲，给足额度再停。 */
const MAX_UNAVAILABLE_SKIPS = 12;

/** 网络类失败计数：任一曲目真的进入 playing、或用户重新发起播放时归零。 */
let failedStreak = 0;
/** 不可播跳过计数（归零时机同上）。 */
let skipStreak = 0;
/** 因音频 error 绕过缓存重解析过的曲目 id（同一首只重试一次）。 */
let audioRetriedId: number | null = null;
/** 已处理过的 MediaError：同一失败源会重复派发 error，用对象身份去重（避免误判为二次失败而跳过）。 */
let lastMediaError: unknown = null;

function invalidateUrl(trackId: number): void {
  // 清掉该曲目所有音质变体（缓存与在途都以 `${trackId}:${quality}` 为键）
  const prefix = `${trackId}:`;
  for (const key of lastUrlCache.keys()) {
    if (key.startsWith(prefix)) lastUrlCache.delete(key);
  }
  urlGeneration.set(trackId, (urlGeneration.get(trackId) ?? 0) + 1);
  // 本地文件也可能损坏（半截 / 编码异常）：一并删掉，否则下次仍会命中同一个坏文件
  invalidateAudioCache(trackId);
}

function resetStreaks(): void {
  failedStreak = 0;
  skipStreak = 0;
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** 解析并缓存播放 URL。`null` = 不可播（值）；抛错 = 真失败，由调用方兜底。 */
async function resolveTrackUrl(trackId: number): Promise<string | null> {
  const quality = requestedQuality();
  const key = urlKey(trackId, quality);
  const gen = urlGeneration.get(trackId) ?? 0;
  const hit = lastUrlCache.get(key);
  if (hit) {
    // 本地缓存命中永不过期；远端签名 URL 有 TTL
    const ttl = hit.local
      ? Infinity
      : hit.url == null
        ? UNAVAILABLE_TTL_MS
        : URL_TTL_MS;
    if (Date.now() - hit.at <= ttl) return hit.url;
  }
  const pending = inflightUrl.get(key);
  if (pending && pending.gen === gen) return pending.promise;
  lastUrlCache.delete(key);

  // ① 本地磁盘优先：按**请求档位**精确命中（零网络、命中即起播）
  const local = await localAudioUrl(trackId, quality).catch((e) => {
    console.warn('[player] 本地缓存查询失败', trackId, e);
    return null;
  });
  if (local) {
    remember(key, trackId, gen, {
      url: local,
      at: Date.now(),
      local: true,
      level: quality,
    });
    return local;
  }

  // ② 本会话已知「这首只能拿到 X」→ 直接用 X 档的本地文件，不再白打一次网络
  const known = grantedLevels.get(trackId);
  if (known && known !== quality) {
    const cached = await localAudioUrl(trackId, known).catch(() => null);
    if (cached) {
      remember(key, trackId, gen, {
        url: cached,
        at: Date.now(),
        local: true,
        level: known,
      });
      return cached;
    }
  }
  // 本地查询是异步的：其间可能已有别的调用发起了网络解析 → 合并
  const raced = inflightUrl.get(key);
  if (raced && raced.gen === gen) return raced.promise;

  // ③ 网络解析（落盘按**实际**档位，见 AudioCacheService 头注释）
  const promise = resolveUrl(trackId, quality)
    .then(async (res) => {
      if (!res?.url) {
        remember(key, trackId, gen, { url: null, at: Date.now() });
        return null;
      }
      const { url, br } = res;
      const granted = res.level ?? quality;
      grantedLevels.set(trackId, granted);
      let playUrl = url;
      let local = false;
      if (granted !== quality) {
        // 降级了：该档位若已缓存过，直接播本地文件（不重复下载，也能断网续听）
        const cached = await localAudioUrl(trackId, granted).catch(() => null);
        if (cached) {
          playUrl = cached;
          local = true;
        } else {
          requestAudioCache(trackId, url, granted);
        }
      } else {
        requestAudioCache(trackId, url, granted);
      }
      remember(key, trackId, gen, {
        url: playUrl,
        at: Date.now(),
        local,
        level: granted,
        br: br ?? null,
      });
      return playUrl;
    })
    .catch(async (e) => {
      // ④ 网络失败（离线 / 接口挂了）→ 退回已缓存的任意档位：能出声比报错好
      const fallback = await bestCachedLevel(trackId);
      if (!fallback) throw e;
      const cached = await localAudioUrl(trackId, fallback).catch(() => null);
      if (!cached) throw e;
      console.warn('[player] 解析失败，退回本地缓存', trackId, fallback, e);
      // 不标 `local: true`（那会让缓存永不过期）：离线退回的可能是低一档的文件，
      // 等网络回来以后重新走一遍流程，才有机会拿到真正请求的档位
      remember(key, trackId, gen, {
        url: cached,
        at: Date.now(),
        level: fallback,
      });
      return cached;
    })
    .finally(() => {
      if (inflightUrl.get(key)?.gen === gen) inflightUrl.delete(key);
    });
  inflightUrl.set(key, { gen, promise });
  return promise;
}

// ── 库音频 / Player 门面（共享同一 AudioCore 实例） ──
// audioCore：物理层，订阅其事件驱动 transport；player：编排层（policy + resolver + load/play）。
export const audioCore = new AudioCore();
const player = new Player(audioCore, queuePolicy, async (track) => {
  // 反竞态：被更新的切歌取代则返回 null（Player 跳过 load/play）
  const mySeq = playSeq;
  const url = await resolveTrackUrl(Number(track.id));
  if (mySeq !== playSeq) return null; // 已被更新的切歌取代
  return url;
});

// 单次订阅音频事件（模块加载挂载一次）。状态权威来自 AudioCore 状态投影（status）。
audioCore.on('timeupdate', (pos) => {
  usePlayerStore.setState({ currentTime: pos });
});
audioCore.on('status', (status) => {
  if (status === 'playing') resetStreaks(); // 真的出声了 → 失败链结束
  usePlayerStore.setState({
    playing: status === 'playing' || status === 'buffering',
    loading: status === 'loading',
    buffering: status === 'buffering',
  });
});
audioCore.on('ended', () => {
  void handleEnded();
});
audioCore.on('error', () => {
  void handleAudioError();
});

const queueStore = () => useQueueStore.getState();

/**
 * 播放编排：乐观 loading → resolve（经 resolver）→ load+play（经 Player）。
 *
 * 解析 / 加载失败绝不把异常抛给调用方（否则 loading 永远不复位、UI 无限转圈、
 * `resume()` 又因 `loading` 早退导致无法自愈）：这里兜底为「复位 loading → 提示 → 跳过」。
 */
async function resolveAndPlay(item: QueueItem): Promise<void> {
  const seq = ++playSeq;
  // 新曲目重置「音频 error 已重试」标记（同一首不重复重试）
  if (item.track_id !== audioRetriedId) audioRetriedId = null;
  usePlayerStore.setState({
    currentTrack: item,
    currentTime: 0,
    duration: item.duration_secs,
    loading: true,
    // 上一首的实际档位不沿用：解析结果回来前不展示（UI 退回显示请求档位）
    quality: null,
    bitrate: null,
  });

  let loaded: boolean;
  try {
    loaded = await player.loadAndPlay(queueItemToCoreTrack(item));
  } catch (e) {
    if (seq !== playSeq) return; // 已被更新的切歌取代，交给新的那次
    // reportError：message 进 toast，detail（reqwest 根因链 / 原始 code）进 devtools
    await failover(reportError('player.resolve', e, '播放失败'));
    return;
  }
  if (seq !== playSeq) return; // 已被更新的切歌取代
  if (!loaded) {
    // 解析成功但不可播（VIP / 无版权 / 仅试听）→ 值分支：提示 + 跳过
    usePlayerStore.setState({ loading: false });
    await skipUnavailable(item);
    return;
  }
  void reportPlayToCloud(item); // 确认可播后上报云端「最近听过」（fire-and-forget，受开关控制）
  // 展示「实际到手」的音质：服务端可能静默降级（非 VIP 请求无损 → exhigh）
  const entry = resolvedEntry(item.track_id);
  usePlayerStore.setState({
    quality: entry?.level ?? null,
    bitrate: entry?.br ?? null,
  });
  notifyDowngrade(entry?.level); // 降级只提示一次，不阻断播放
  prefetchNext(); // 预取下一首 URL，把解析失败移出下一次切歌事务
}

/**
 * 云端「最近听过」上报：只在**确认能播**（已装载）后发一次。
 *
 * 未登录 / `savePlaybackHistory` 关闭时直接跳过（云端记录也属于播放历史）；
 * 失败仅告警，绝不打断播放。
 *
 * 关于接口：`/api/feedback/weblog` 上有两种日志，**只有 clientlog eapi 的
 * `startplay` 会写「最近听过」**；crate 自带的 `scrobble`（weapi + `music.163.com`
 * + `action: "play"`）服务端会回 `success` 但静默丢弃（不落库）。
 */
async function reportPlayToCloud(item: QueueItem): Promise<void> {
  const { savePlaybackHistory } = usePlayerSettingsStore.getState().player;
  if (!savePlaybackHistory || useAuthStore.getState().userId == null) return;
  try {
    await scrobblePlay(item.track_id, item.album_id ?? 0);
  } catch (e) {
    console.warn('[player] scrobble failed', item.track_id, e);
  }
}

/**
 * 预取下一首的播放 URL（对齐 YesPlayMusic `_cacheNextTrack`）。
 * 只预热缓存，不改任何状态；失败静默吞掉，真正切到它时由 resolveAndPlay 统一处理。
 */
function prefetchNext(): void {
  const next = queueStore().peekNext();
  if (!next) return;
  void resolveTrackUrl(next.track_id).catch(() => null);
}

/**
 * 单曲循环（`repeat = one`）的「原地重播」：不重新解析 URL、不重新 load 媒体，
 * 只把播放位置拉回 0 —— 省掉一次 media load 的起播空隙与重复下载。
 *
 * 不重新 `recordPlay`：循环听同一首不重复写播放历史（语义是「一次收听一条记录」）。
 * 无有效 src（启动恢复 / 清空后）时回退到完整重载。
 */
async function replayCurrent(item: QueueItem): Promise<void> {
  if (audioCore.getStatus() === 'idle' || !audioCore.src) {
    await resolveAndPlay(item);
    return;
  }
  playSeq += 1; // 使在途 resolve 失效，避免旧结果回写
  audioCore.seek(0);
  usePlayerStore.setState({
    currentTrack: item,
    currentTime: 0,
    duration: item.duration_secs,
    loading: false,
  });
  await player.play();
  prefetchNext();
}

/**
 * 音质切换后原地重载当前曲（保留进度与播放/暂停状态）。
 *
 * 两种“尽量不动”的情况直接返回：
 * - 没有当前曲 / 尚未装载（`idle`）：下一首起播自然用新档位；
 * - 解析失败或期间又切了歌/曲目不可播：不打断当前正在放的音频。
 *
 * 本地磁盘缓存按档位分文件（`{id}-{level}.{ext}`），所以这里会命中该档位的文件或重新下载。
 */
async function reloadCurrentForQuality(): Promise<void> {
  const item = usePlayerStore.getState().currentTrack;
  // `idle` = 尚未装载；`ended` = 本首已自然结束（下次起播本来就重新解析）→ 都不需要原地重载
  const status = audioCore.getStatus();
  if (!item || status === 'idle' || status === 'ended') return;
  const position = audioCore.getPosition();
  const wasPlaying = audioCore.playing;
  const seq = ++playSeq; // 使在途解析失效（旧档位的地址不再可用）
  let url: string | null;
  try {
    url = await resolveTrackUrl(item.track_id);
  } catch (e) {
    toast.error(reportError('player.quality', e, '切换音质失败'));
    return;
  }
  if (seq !== playSeq || !url) return;
  const entry = resolvedEntry(item.track_id);
  usePlayerStore.setState({
    quality: entry?.level ?? null,
    bitrate: entry?.br ?? null,
  });
  notifyDowngrade(entry?.level);
  audioCore.load(url);
  // 元数据就绪（loading → paused）后才能定位：之前设 currentTime 会被浏览器重置为 0
  const offs: (() => void)[] = [];
  const cleanup = () => {
    for (const off of offs.splice(0)) off();
  };
  offs.push(
    audioCore.on('status', (status) => {
      if (status !== 'paused') return;
      cleanup();
      audioCore.seek(position);
      if (wasPlaying) void player.play();
    }),
    audioCore.on('error', cleanup),
  );
  prefetchNext(); // 下一首也按新档位预取
}

/** 设置里的音质档位上一次已应用的值（订阅据此判断是不是真的变了）。 */
let appliedQuality = requestedQuality();

/**
 * 清空解析缓存：URL 与「实际档位」都是「账号 + 请求档位」下的结论，换任何一个都得重学。
 *
 * 不清的话会踩两个坑：旧签名的 URL 不可再用；该曲目的「降级记忆」会把新档位/新账号
 * 直接压到旧结论上（换账号后明明有无损权限，却还按之前的降级档播）。
 */
function resetResolutionCaches(): void {
  lastUrlCache.clear();
  urlGeneration.clear();
  grantedLevels.clear();
  downgradeNotified.clear();
}

/**
 * 音质变更 → 清解析缓存 + 原地重载当前曲。
 *
 * 只订阅 settings store（设置页/其他入口改的都是它）；同档位反复 set 不做事，
 * 因为 volume / desktopLyrics 等其他字段也在同一个 store 里变。
 */
usePlayerSettingsStore.subscribe(() => {
  const quality = requestedQuality();
  if (quality === appliedQuality) return;
  appliedQuality = quality;
  resetResolutionCaches();
  void reloadCurrentForQuality();
});

/**
 * 登录态变更（登录 / 登出 / 换号）→ 清解析缓存。
 *
 * 音质权限跟着账号走：登出后高音质会被降级，登录 VIP 后才真能拿到无损；
 * 不重建的话，负缓存（60s）与「降级记忆」会把这个变化延迟很久才生效。
 */
let appliedUserId = useAuthStore.getState().userId;
useAuthStore.subscribe(() => {
  const userId = useAuthStore.getState().userId;
  if (userId === appliedUserId) return;
  appliedUserId = userId;
  resetResolutionCaches();
});

/** 失败兜底：连续失败达上限即停（避免断网时无限跳歌），否则提示并推进下一首。 */
async function failover(message: string): Promise<void> {
  failedStreak += 1;
  if (failedStreak > MAX_FAILED_STREAK) {
    toast.error('连续多首歌曲无法播放，已暂停', { id: 'play-fail' });
    pauseAudio();
    return;
  }
  toast.error(message, { id: 'play-fail' });
  await stepForward();
}

/**
 * 不可播（VIP / 无版权 / 仅试听）→ 对齐 YesPlayMusic 的值分支：提示 + 跳过。
 * 不计入网络失败计数；skipStreak 防「整队不可播」或 repeat-one 时空转。
 */
async function skipUnavailable(item: QueueItem): Promise<void> {
  skipStreak += 1;
  if (skipStreak > MAX_UNAVAILABLE_SKIPS) {
    toast.error('没有可播放的歌曲，已暂停', { id: 'play-skip' });
    pauseAudio();
    return;
  }
  toast.error(`无法播放：${item.title}`, { id: 'play-skip' });
  await skipForward();
}

/** 手动语义推进（跳过当前曲，不回放）——不可播跳过与 `next()` 命令共用。 */
async function skipForward(): Promise<void> {
  const q = queueStore();
  if (q.queue.length === 0) {
    pauseAudio();
    return;
  }
  const step = q.manualNext();
  if (step.type === 'play') {
    const track = q.queue[step.index];
    if (track) await resolveAndPlay(track);
    return;
  }
  if (q.isFmActive()) {
    await fmContinuation();
    return;
  }
  pauseAudio();
}

/** 音频元素报错（签名 URL 过期 / CDN 403 / 网络中断）：绕过缓存重解析一次，仍失败则跳过该曲。 */
async function handleAudioError(): Promise<void> {
  usePlayerStore.setState({ playing: false, loading: false });
  const item = usePlayerStore.getState().currentTrack;
  // 空 src（reset / clearQueue 触发的空 src 报错）→ 忽略
  if (!item || !audioCore.src) return;
  // 同一失败源会重复派发 error —— 用 mediaError 对象身份去重，只处理一次
  const error = audioCore.mediaError;
  if (error && error === lastMediaError) return;
  lastMediaError = error;
  if (audioRetriedId !== item.track_id) {
    audioRetriedId = item.track_id;
    invalidateUrl(item.track_id);
    console.warn(
      '[player] audio error, retrying with fresh url:',
      item.track_id,
    );
    await resolveAndPlay(item);
    return;
  }
  await failover('音频加载失败，已跳过');
}

/** 自动语义推进（尊重 repeat）：自然结束与网络失败共用，无处可去则停。 */
async function stepForward(): Promise<void> {
  if (queueStore().queue.length === 0) {
    pauseAudio();
    return;
  }
  const step = queueStore().onTrackEnd();
  if (step.type === 'play') {
    const track = queueStore().queue[step.index];
    if (track) await resolveAndPlay(track);
    return;
  }
  if (step.type === 'replayCurrent') {
    const cur = queueStore().currentTrack();
    if (cur) await replayCurrent(cur);
    return;
  }
  if (queueStore().isFmActive()) {
    await fmContinuation();
    return;
  }
  pauseAudio();
}

/** FM 取数 + 重试（线性退避）。全试尽仍抛错，由调用方决定提示与暂停。 */
async function fetchFmWithRetry(): Promise<QueueItem[]> {
  let last: unknown;
  for (let attempt = 0; attempt < FM_FETCH_ATTEMPTS; attempt++) {
    try {
      // oxlint-disable-next-line no-await-in-loop 重试必须串行 + 退避，不能 Promise.all
      return await fetchFm();
    } catch (e) {
      last = e;
      if (attempt < FM_FETCH_ATTEMPTS - 1) {
        // oxlint-disable-next-line no-await-in-loop 退避等待
        await delay(FM_FETCH_BACKOFF_MS * (attempt + 1));
      }
    }
  }
  throw last;
}

/** FM 续歌循环：End + personal_fm → fetch → appendFm → 重推进。带防死循环 guard。 */
async function fmContinuation(): Promise<void> {
  for (let i = 0; i < FM_CONTINUE_MAX; i++) {
    const before = fmPolicy.tracks.length;
    let tracks: QueueItem[];
    try {
      tracks = await fetchFmWithRetry();
    } catch (e) {
      toast.error(reportError('player.fm', e, '私人漫游加载失败'), {
        id: 'play-fail',
      });
      pauseAudio();
      return;
    }
    if (tracks.length === 0) {
      pauseAudio();
      return;
    }
    queueStore().appendFm(tracks);
    if (fmPolicy.tracks.length === before) {
      pauseAudio(); // 无新曲目，停止不空转
      return;
    }
    const step = queueStore().manualNext();
    if (step.type === 'play') {
      const track = queueStore().queue[step.index];
      if (track) await resolveAndPlay(track);
      return;
    }
    // 仍 End → 继续取；超上限停止
  }
  pauseAudio();
}

/** 暂停：当前曲仍在队列里，保留 transport 的曲目信息（UI 需继续显示）。 */
function pauseAudio(): void {
  player.pause();
  usePlayerStore.setState({ playing: false, loading: false });
}

/**
 * 停播并复位 transport（队列已空：清空队列 / 删掉最后一首 / 切回空用户队列）。
 *
 * 与 `pauseAudio` 的区别就在这里：队列空了 = 没有「当前曲」可显示，
 * 必须把 `currentTrack` 一并清掉，否则 PlayerBar / 播放页仍停在已被删除的那首上
 * （表现为「删掉最后一首后播放器毫无变化，只有清空队列才更新」）。
 */
function resetTransport(): void {
  playSeq += 1; // 使在途 resolve 失效，避免旧曲目被回写
  audioCore.reset();
  resetStreaks();
  audioRetriedId = null;
  lastMediaError = null;
  usePlayerStore.setState({
    currentTrack: null,
    playing: false,
    loading: false,
    buffering: false,
    currentTime: 0,
    duration: 0,
    quality: null,
    bitrate: null,
  });
}

/** 自然播放结束：按 repeat 推进 / FM 续歌 / 停。 */
async function handleEnded(): Promise<void> {
  await stepForward();
}

export interface PlayerController {
  // transport 命令
  seek: (time: number) => void;
  resume: () => Promise<void>;
  pause: () => void;
  toggle: () => void;
  setVolume: (volume: number) => void;
  setMuted: (muted: boolean) => void;
  cycleRepeat: () => void;
  toggleShuffle: () => void;

  // 队列命令（编排）
  play: (track: Track) => Promise<void>;
  replaceAndPlay: (tracks: Track[], startIndex?: number) => Promise<void>;
  next: () => Promise<void>;
  prev: () => Promise<void>;
  addToQueue: (track: Track) => Promise<void>;
  playNext: (track: Track) => Promise<void>;
  playFromIndex: (index: number) => Promise<void>;
  removeFromQueue: (index: number) => Promise<void>;
  clearQueue: () => void;
  setContentSource: (source: ContentSource) => Promise<void>;
  fmTrash: () => Promise<void>;

  /** 启动恢复：交给 queue store 重建两条 policy 并回填 transport 当前曲。 */
  restore: (snapshot: QueueSnapshot) => void;
}

export const playerService: PlayerController = {
  restore: (snapshot) => {
    useQueueStore.getState().restore(snapshot);
    playSeq += 1;
    resetResolutionCaches(); // 内存缓存清空（磁盘缓存在 Rust 侧，跨重启保留）
    appliedQuality = requestedQuality(); // 启动播种的档位视为「已应用」（无需重载）
    applyLimitFromSettings(); // 启动即把设置里的缓存上限下发给 Rust
    resetStreaks();
    audioRetriedId = null;
    lastMediaError = null;
    usePlayerStore.setState({
      currentTrack: useQueueStore.getState().currentTrack(),
      duration: useQueueStore.getState().currentTrack()?.duration_secs ?? 0,
      currentTime: 0,
      playing: false,
      loading: false,
      buffering: false,
    });
    audioCore.reset();
  },

  seek: (time) => {
    usePlayerStore.setState({ currentTime: time });
    player.seek(time);
  },
  resume: async () => {
    if (usePlayerStore.getState().loading) return;
    resetStreaks(); // 用户主动播放：重置失败链
    const q = () => useQueueStore.getState();
    // ended 后点播放 → 从头播放队列
    if (q().isEnded()) {
      const track = q().restart();
      if (track) await resolveAndPlay(track);
      return;
    }
    const cur = q().currentTrack();
    if (!cur) return;
    // 无已加载 source（恢复/清空后）→ 重载当前曲
    if (audioCore.getStatus() === 'idle') {
      await resolveAndPlay(cur);
      return;
    }
    await player.play(); // play → playing 事件驱动 playing/loading
  },
  pause: () => {
    player.pause();
  },
  toggle: () => {
    if (usePlayerStore.getState().loading) return;
    void (usePlayerStore.getState().playing
      ? playerService.pause()
      : playerService.resume());
  },
  setVolume: (volume) => {
    usePlayerSettingsStore.getState().updatePlayer({ volume, isMuted: false });
    player.volume = volume;
  },
  setMuted: (muted) => {
    const p = usePlayerSettingsStore.getState().player;
    if (p.isMuted === muted) return;
    usePlayerSettingsStore.getState().updatePlayer({ isMuted: muted });
    player.volume = muted ? 0 : p.volume;
  },
  cycleRepeat: () => {
    const q = () => useQueueStore.getState();
    const { repeat, contentSource } = q();
    const next: RepeatMode =
      contentSource === 'personal_fm'
        ? repeat === 'one'
          ? 'off'
          : 'one'
        : NEXT_REPEAT[repeat];
    q().setRepeat(next);
  },
  toggleShuffle: () => {
    const q = () => useQueueStore.getState();
    if (q().contentSource === 'personal_fm') return;
    q().setOrder(q().order === 'shuffle' ? 'sequential' : 'shuffle');
  },

  play: async (track) => {
    resetStreaks();
    const cur = useQueueStore.getState().playTrack(songToQueueItem(track));
    if (cur) await resolveAndPlay(cur);
  },
  replaceAndPlay: async (tracks, startIndex = 0) => {
    resetStreaks();
    const cur = useQueueStore
      .getState()
      .replacePlay(tracks.map(songToQueueItem), startIndex);
    if (cur) await resolveAndPlay(cur);
  },
  next: async () => {
    resetStreaks();
    await skipForward();
  },
  prev: async () => {
    resetStreaks();
    const cur = useQueueStore.getState().prev();
    if (cur) await resolveAndPlay(cur);
  },
  addToQueue: async (track) => {
    useQueueStore.getState().append([songToQueueItem(track)]);
  },
  playNext: async (track) => {
    useQueueStore.getState().insertNext(songToQueueItem(track));
  },
  playFromIndex: async (index) => {
    resetStreaks();
    const cur = useQueueStore.getState().playQueueAt(index);
    if (cur) await resolveAndPlay(cur);
  },
  removeFromQueue: async (index) => {
    const q = () => useQueueStore.getState();
    const before = q().currentTrack()?.track_id;
    q().removeAt(index);
    // 删掉的是最后一首 → 队列里已无曲目：复位 transport（不能只 pause，见 resetTransport）
    if (q().queue.length === 0) {
      resetTransport();
      return;
    }
    const after = q().currentTrack();
    if (after?.track_id !== before) {
      if (after) await resolveAndPlay(after);
      else await pauseAudio();
    }
  },
  clearQueue: () => {
    useQueueStore.getState().clear();
    resetTransport();
  },
  setContentSource: async (source) => {
    resetStreaks();
    const q = () => useQueueStore.getState();
    if (source === 'personal_fm') {
      const tracks = await fetchFmWithRetry(); // 取数失败抛给调用方（viewmodel）提示
      if (tracks.length === 0) return;
      q().enterFm(tracks); // 整批入队：留 lookahead 供下一首预取
      const cur = q().currentTrack();
      if (cur) await resolveAndPlay(cur);
    } else {
      const cur = q().exitFm();
      // 用户队列为空（FM 期间清空 / 从未入队）→ 没有可播曲目，停播并复位
      if (cur) await resolveAndPlay(cur);
      else resetTransport();
    }
  },
  fmTrash: async () => {
    resetStreaks();
    const q = () => useQueueStore.getState();
    if (!q().isFmActive()) return;
    const removed = q().removeFmCurrent();
    if (!removed) return;
    await trashFm(removed.track_id);
    const cur = q().currentTrack();
    if (cur) await resolveAndPlay(cur);
    // FM 队列也被删空 → 同样复位 transport（否则播放器仍显示刚「不感兴趣」的那首）
    else if (q().queue.length === 0) resetTransport();
    else await pauseAudio();
  },
};
