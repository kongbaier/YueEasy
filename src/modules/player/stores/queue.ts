import { create } from 'zustand';
import * as playerApi from '@/tauri/player';
import type { RustContentSource, Track } from '@/shared/types/player';
import { usePlayerStore } from './player';
import { songToQueueItem } from '@/shared/utils/mappers';

// ── Helpers ──

export { formatQueueCount } from '@/shared/utils/format';

/** Rust 引擎「队列已尽」哨兵（advance 语义 play_next / fm_trash 正常结束）—— 非错误。 */
export function isQueueEnded(err: unknown): boolean {
  if (err instanceof Error) return err.message === 'queue ended';
  return String(err) === 'queue ended';
}

/** 播放命令统一包装：置 loading 态；「队列已尽」吞掉不抛（正常结束语义）。 */
async function withLoading(op: () => Promise<unknown>): Promise<void> {
  usePlayerStore.setState({ loading: true });
  try {
    await op();
  } catch (err) {
    usePlayerStore.setState({ loading: false });
    if (isQueueEnded(err)) return;
    throw err;
  }
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
  /** 切换内容来源（"queue" / "personal_fm"）—— 取代原 enterFm/exitFm。 */
  setContentSource: (source: RustContentSource) => Promise<void>;
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
      await withLoading(() => playerApi.playTrack(songToQueueItem(track)));
    },

    replaceAndPlay: async (tracks, startIndex = 0) => {
      await withLoading(() =>
        playerApi.replaceAndPlay(tracks.map(songToQueueItem), startIndex),
      );
    },

    next: async () => {
      await withLoading(() => playerApi.playNext());
    },

    prev: async () => {
      await withLoading(() => playerApi.playPrev());
    },

    addToQueue: async (track) => {
      await playerApi.appendToQueue([songToQueueItem(track)]);
    },

    playNext: async (track) => {
      await playerApi.insertNext(songToQueueItem(track));
    },

    playFromIndex: async (index) => {
      await withLoading(() => playerApi.playQueueAt(index));
    },

    removeFromQueue: async (index) => {
      await playerApi.removeFromQueue(index);
    },

    clearQueue: () => {
      void playerApi.clearQueue();
    },

    setContentSource: async (source) => {
      await withLoading(() => playerApi.setContentSource(source));
    },

    fmTrash: async () => {
      await withLoading(() => playerApi.fmTrash());
    },
  }),
);
