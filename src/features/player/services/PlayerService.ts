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
import { NEXT_REPEAT } from '@/shared/constants/player';
import { songToQueueItem } from '@/shared/utils/mappers';
import { AudioCore } from '@/shared/lib/player-core/audio';
import type { PlayerCoreTrack } from '@/shared/lib/player-core/models/track';
import { Player } from '../core/player';
import type { ContentSource, QueueSnapshot } from '../stores/queueStore';
import { fmPolicy, queuePolicy, useQueueStore } from '../stores/queueStore';
import { fetchFm, resolveUrl, trashFm } from './PlayerDataService';
import {
  applyLimitFromSettings,
  invalidate as invalidateAudioCache,
  localUrl as localAudioUrl,
  requestCache as requestAudioCache,
} from './AudioCacheService';
import { usePlayerStore } from '../stores/playerStore';
import { recordPlay } from './PlayHistoryService';
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
 */
type UrlEntry = { url: string | null; at: number; local?: boolean };
const lastUrlCache = new Map<string, UrlEntry>();
/** 在途请求：预取与切歌可能同时解析同一首，合并为一次网络请求。 */
const inflightUrl = new Map<
  string,
  { gen: number; promise: Promise<string | null> }
>();
/** 缓存代际：invalidate 时递增，用于丢弃「作废后到达」的在途结果。 */
const urlGeneration = new Map<string, number>();
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
  const key = String(trackId);
  lastUrlCache.delete(key);
  urlGeneration.set(key, (urlGeneration.get(key) ?? 0) + 1);
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
  const key = String(trackId);
  const gen = urlGeneration.get(key) ?? 0;
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

  // ① 本地磁盘缓存优先：文件没有签名、不会 403，命中即起播
  const local = await localAudioUrl(trackId).catch((e) => {
    console.warn('[player] 本地缓存查询失败', trackId, e);
    return null;
  });
  if (local) {
    if ((urlGeneration.get(key) ?? 0) === gen) {
      lastUrlCache.set(key, { url: local, at: Date.now(), local: true });
    }
    return local;
  }
  // 本地查询是异步的：其间可能已有别的调用发起了网络解析 → 合并
  const raced = inflightUrl.get(key);
  if (raced && raced.gen === gen) return raced.promise;

  // ② 网络解析（成功后请求后台落盘，下次播放走本地）
  const promise = resolveUrl(trackId)
    .then((url) => {
      // 已被 invalidate（音频 error 后绕过缓存重解析）→ 不回填，避免又拿到同一个坏 URL
      if ((urlGeneration.get(key) ?? 0) === gen) {
        lastUrlCache.set(key, { url, at: Date.now() });
      }
      if (url) requestAudioCache(trackId, url);
      return url;
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
  recordPlay(item); // 成功装载后才记本地播放记录（fire-and-forget，受开关控制）
  prefetchNext(); // 预取下一首 URL，把解析失败移出下一次切歌事务
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
    console.warn('[player] audio error, retrying with fresh url:', item.track_id);
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
    lastUrlCache.clear(); // 内存缓存清空（磁盘缓存在 Rust 侧，跨重启保留）
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
