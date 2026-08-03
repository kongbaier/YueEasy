import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { Track } from '@/core/types';
import { playerService } from '../services/PlayerService';
import { TauriStorage } from '@/tauri/storage';

// ── Helpers ──

export { formatQueueCount } from '@/shared/utils/format';

/** Push service queue state into the Zustand store (must copy the array). */
export function syncQueueDerived(): void {
  useQueueStore.setState({
    queue: [...playerService.queue],
    currentTrack: playerService.currentTrack,
    queueLength: playerService.queueLength,
    isFm: playerService.isFm,
    fmExitWillEmpty: playerService.fmExitWillEmpty,
    canPrev: playerService.canPrev,
  });
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
  persist(
    (): QueueStore => {
      // Auto-sync derived queue state whenever the service mutates the queue
      // (including auto-advance when the current track ends).
      playerService.on('queuechange', syncQueueDerived);

      return {
        queue: [],
        currentTrack: null,
        queueLength: 0,
        isFm: false,
        fmExitWillEmpty: false,
        canPrev: true,

        play: async (track) => {
          await playerService.play(track);
          syncQueueDerived();
        },

        replaceAndPlay: async (tracks, startIndex = 0) => {
          await playerService.replaceAndPlay(tracks, startIndex);
          syncQueueDerived();
        },

        next: async () => {
          await playerService.next();
          syncQueueDerived();
        },

        prev: async () => {
          await playerService.prev();
          syncQueueDerived();
        },

        addToQueue: async (track) => {
          await playerService.addToQueue(track);
          syncQueueDerived();
        },

        playNext: async (track) => {
          await playerService.playNext(track);
          syncQueueDerived();
        },

        playFromIndex: async (index) => {
          await playerService.playFromIndex(index);
          syncQueueDerived();
        },

        removeFromQueue: async (index) => {
          await playerService.removeFromQueue(index);
          syncQueueDerived();
        },

        clearQueue: () => {
          playerService.clearQueue();
          syncQueueDerived();
        },

        enterFm: async (tracks) => {
          await playerService.enterFm(tracks);
          syncQueueDerived();
        },

        exitFm: async () => {
          await playerService.exitFm();
          syncQueueDerived();
        },

        fmTrash: async () => {
          await playerService.fmTrash();
          syncQueueDerived();
        },
      };
    },
    {
      name: 'player-queue',
      storage: createJSONStorage(() => TauriStorage),
      partialize: (state) =>
        playerService.isFm
          ? { queue: [], index: -1, currentTime: 0 } // 漫游会话不落盘
          : {
              queue: state.queue,
              index: playerService.currentIndex,
              currentTime: 0, // placeholder — currentTime lives in player store
            },
      onRehydrateStorage: () => (state) => {
        const data = state as
          | { queue?: Track[]; index?: number }
          | undefined;
        if (data?.queue?.length) {
          playerService.restoreQueue(data.queue, data.index ?? 0);
          // Re-sync Zustand from the service
          syncQueueDerived();
        }
      },
    },
  ),
);
