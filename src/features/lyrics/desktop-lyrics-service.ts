// 桌面歌词服务（歌词域就近）：主窗口侧的「发布器 + 唯一权威」。
//
// 职责：
//   1. 开关 / 锁定 / 排版设置落到 settings（持久化），并把窗口能力透传给 Rust；
//   2. 把当前曲目的歌词 + 播放进度 + 设置推给桌面歌词窗口；
//   3. 受理桌面歌词窗口发来的命令（播放控制 / 开关 / 锁定 / 改设置）。
//
// 推送策略（IPC 带宽是唯一的约束）：
//   - 歌词：切歌 / 窗口主动请求时整首下发一次（失败即「暂无歌词」，不是错误）；
//   - 进度：跟随 playerStore 的 `timeupdate`（约 4Hz）下发**锚点**，
//     桌面歌词窗口自己按锚点插值到 60fps —— 60fps 一帧都不走 IPC。
//
// 依赖方向：service → stores / infra（@/tauri/desktopLyrics）+ 同功能 lyrics-service。

import { queryClient } from '@/shared/lib/queryClient';
import { toast } from '@/shared/lib/toast';
import { reportError } from '@/shared/utils/error';
import type {
  DesktopLyricsLayoutPatch,
  DesktopLyricsRequest,
  DesktopLyricsSnapshot,
} from '@/shared/types/desktopLyrics';
import type { DesktopLyricsSettings } from '@/shared/types/settings';
import {
  emitDesktopLyricsPlayback,
  emitDesktopLyricsSnapshot,
  emitDesktopLyricsState,
  onDesktopLyricsRequest,
  setDesktopLyricsEnabled,
  setDesktopLyricsLocked,
} from '@/tauri/desktopLyrics';
import { usePlayerSettingsStore } from '@/features/player/stores/playerSettingsStore';
import { usePlayerStore } from '@/features/player/stores/playerStore';
import { playerService } from '@/features/player/services/PlayerService';
import { fetchLyrics } from './lyrics-service';
import { resolveLyricLines } from './lines';

const EMPTY_SNAPSHOT: DesktopLyricsSnapshot = {
  trackId: null,
  title: '',
  artist: '',
  lines: [],
  translations: [],
};

function lyricsSettings(): DesktopLyricsSettings {
  return usePlayerSettingsStore.getState().player.desktopLyrics;
}

function isEnabled(): boolean {
  return lyricsSettings().enabled;
}

function isLocked(): boolean {
  return lyricsSettings().locked;
}

/** 改桌面歌词设置：settings 是唯一真相（持久化 → 立刻回推给窗口）。 */
function updateSettings(patch: Partial<DesktopLyricsSettings>): void {
  const store = usePlayerSettingsStore.getState();
  store.updatePlayer({
    desktopLyrics: { ...store.player.desktopLyrics, ...patch },
  });
}

/** 歌词取数序号：切歌后到达的旧请求直接丢弃（反竞态）。 */
let lyricSeq = 0;
let started = false;
/** 上次推送的投影值，用于从 store 变化里挑出「该推了」的时刻。 */
let lastTrackId: number | null | undefined;
let lastPlaying: boolean | undefined;
let lastPosition = -1;

function pushPlayback(): void {
  if (!isEnabled()) return;
  const { currentTime, duration, playing, currentTrack } =
    usePlayerStore.getState();
  void emitDesktopLyricsPlayback({
    positionMs: Math.round(currentTime * 1000),
    durationMs: Math.round(duration * 1000),
    playing,
    hasTrack: currentTrack !== null,
  });
}

function pushState(): void {
  if (!isEnabled()) return;
  void emitDesktopLyricsState({
    locked: isLocked(),
    settings: lyricsSettings(),
  });
}

/**
 * 整首歌词快照。
 * 与歌词页共用 `['lyrics', trackId]` 查询缓存：桌面歌词不会额外请求一次歌词接口。
 */
async function pushSnapshot(trackId: number | null): Promise<void> {
  if (!isEnabled()) return;

  const seq = ++lyricSeq;
  let snapshot = EMPTY_SNAPSHOT;

  if (trackId !== null) {
    const track = usePlayerStore.getState().currentTrack;
    try {
      const data = await queryClient.fetchQuery({
        queryKey: ['lyrics', trackId],
        queryFn: () => fetchLyrics(trackId),
        staleTime: Infinity,
      });
      if (seq !== lyricSeq) return;

      const { lines, translations } = resolveLyricLines(data);
      snapshot = {
        trackId,
        title: track?.title ?? '',
        artist: (track?.artists ?? []).map((artist) => artist.name).join(' / '),
        lines,
        translations,
      };
    } catch {
      // 歌词取不到就是「暂无歌词」：不影响播放，也不弹错误
      if (seq !== lyricSeq) return;
      snapshot = {
        ...EMPTY_SNAPSHOT,
        trackId,
        title: track?.title ?? '',
        artist: (track?.artists ?? []).map((artist) => artist.name).join(' / '),
      };
    }
  }

  if (seq !== lyricSeq) return;
  void emitDesktopLyricsSnapshot(snapshot);
}

/** store 变化 → 只在「切歌 / 播放态翻转 / 进度变化」时推。 */
function sync(force: boolean): void {
  const { currentTrack, currentTime, playing } = usePlayerStore.getState();
  const trackId = currentTrack?.track_id ?? null;

  const trackChanged = force || trackId !== lastTrackId;
  if (trackChanged) {
    lastTrackId = trackId;
    void pushSnapshot(trackId);
  }

  if (
    trackChanged ||
    force ||
    playing !== lastPlaying ||
    currentTime !== lastPosition
  ) {
    lastPlaying = playing;
    lastPosition = currentTime;
    pushPlayback();
    if (trackChanged || force) pushState();
  }
}

async function setEnabled(enabled: boolean): Promise<void> {
  // settings 先落（持久化），窗口能力随后：即使窗口创建失败，开关状态也不会与设置项不一致
  updateSettings({ enabled });

  try {
    await setDesktopLyricsEnabled(enabled);
  } catch (error) {
    toast.error(reportError('desktopLyrics', error));
    return;
  }
  if (!enabled) return;

  await setDesktopLyricsLocked(isLocked()).catch((error: unknown) =>
    toast.error(reportError('desktopLyrics', error)),
  );
  // 已有窗口再次开启时不会重新挂载，这里主动补一次全量（新窗口会自己请求 sync）
  sync(true);
}

async function setLocked(locked: boolean): Promise<void> {
  updateSettings({ locked });
  await setDesktopLyricsLocked(locked).catch((error: unknown) =>
    toast.error(reportError('desktopLyrics', error)),
  );
  pushState();
}

/** 窗口内设置面板改排版：落 settings 后立刻回推（窗口不持有可写状态）。 */
function updateLayout(patch: DesktopLyricsLayoutPatch): void {
  updateSettings(patch);
  pushState();
}

function handleRequest(request: DesktopLyricsRequest): void {
  const { action } = request;

  switch (action) {
    case 'sync':
      sync(true);
      break;
    case 'close':
      void setEnabled(false);
      break;
    case 'lock':
      void setLocked(true);
      break;
    case 'unlock':
      void setLocked(false);
      break;
    case 'prev':
      playerService.prev();
      break;
    case 'next':
      playerService.next();
      break;
    case 'toggle-play':
      playerService.toggle();
      break;
    case 'update-layout':
      updateLayout(request.patch);
      break;
    case 'log':
      console.error('[desktop-lyrics:window]', request.message);
      break;
    default:
      break;
  }
}

/**
 * 启动主窗口侧的发布器（`bootstrap` 在 settings 落盘后调用一次，幂等）。
 *
 * 一直在跑（即使桌面歌词关着）：关着时所有 push 都是 no-op，
 * 但 `last*` 仍在跟踪，开启那一刻 `sync(true)` 就能给出正确状态。
 */
function start(): void {
  if (started) return;
  started = true;

  usePlayerStore.subscribe(() => sync(false));

  void onDesktopLyricsRequest(handleRequest);

  // 上次退出时是开着的 → 恢复
  if (isEnabled()) void setEnabled(true);
}

export const desktopLyricsService = {
  start,
  setEnabled,
  setLocked,
  isEnabled,
  isLocked,
};
