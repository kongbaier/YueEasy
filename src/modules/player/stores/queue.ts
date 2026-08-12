import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import type { Track } from '@/shared/types/player';
import { playerService } from '../services/PlayerService';
import { songToQueueItem } from '@/shared/utils/mappers';
import type { PlayUrlInfo } from '@/shared/types/player';

// ── Helpers ──

export { formatQueueCount } from '@/shared/utils/format';

/** Rust 引擎：invoke 获取 PlayUrlInfo → 本地 AudioCore load + play（复用 playerService 的 audioCore 单例）。 */
async function rustLoadAndPlay(command: string, args?: Record<string, unknown>): Promise<void> {
  // 切歌前上报旧曲目最终进度/状态（引擎随后重置位置）
  await playerService.flushPosition();
  const result = await invoke<PlayUrlInfo>(command, args);
  await playerService.audioCore.load(result.url);
  await playerService.audioCore.play();
}

// ── Store ──

export interface QueueStore {
  queue: Track[];
  currentTrack: Track | null;
  queueLength: number;
  isFm: boolean;
  /** 退出漫游是否会清空队列（进入漫游前无队列快照）。 */
  fmExitWillEmpty: boolean;
  canPrev: boolean;

  play: (track: Track) => Promise<void>;
  replaceAndPlay: (tracks: Track[], startIndex?: number) => Promise<void>;
  next: () => Promise<void>;
  prev: () => Promise<void>;
  addToQueue: (track: Track) => Promise<void>;
  playNext: (track: Track) => Promise<void>;
  playFromIndex: (index: number) => Promise<void>;
  removeFromQueue: (index: number) => Promise<void>;
  clearQueue: () => void;
  enterFm: (tracks?: Track[]) => Promise<void>;
  exitFm: () => Promise<void>;
  fmTrash: () => Promise<void>;
}

export const useQueueStore = create<QueueStore>()(
  (): QueueStore => ({
    queue: [],
    currentTrack: null,
    queueLength: 0,
    isFm: false,
    fmExitWillEmpty: false,
    canPrev: true,

    play: async (track) => {
      await rustLoadAndPlay('play_track', { track: songToQueueItem(track) });
    },

    replaceAndPlay: async (tracks, startIndex = 0) => {
      await rustLoadAndPlay('replace_and_play', {
        tracks: tracks.map(songToQueueItem),
        startIndex,
      });
    },

    next: async () => {
      await rustLoadAndPlay('play_next');
    },

    prev: async () => {
      await rustLoadAndPlay('play_prev');
    },

    addToQueue: async (track) => {
      await invoke<void>('append_to_queue', { tracks: [songToQueueItem(track)] });
    },

    playNext: async (track) => {
      await invoke<void>('insert_next', { track: songToQueueItem(track) });
    },

    playFromIndex: async (index) => {
      await rustLoadAndPlay('play_queue_at', { index });
    },

    removeFromQueue: async (index) => {
      await invoke<void>('remove_from_queue', { index });
    },

    clearQueue: () => {
      void invoke<void>('clear_queue');
    },

    enterFm: async (_tracks) => {
      // Rust 自动取歌（enter_fm 无参数），预请求候选歌暂不使用
      await rustLoadAndPlay('enter_fm');
    },

    exitFm: async () => {
      // 切回原队列前上报 FM 曲目最终进度/状态
      await playerService.flushPosition();
      const result = await invoke<PlayUrlInfo>('exit_fm');
      if (result.track) {
        await playerService.audioCore.load(result.url);
        await playerService.audioCore.play();
      }
    },

    fmTrash: async () => {
      await rustLoadAndPlay('fm_trash');
    },
  }),
);
