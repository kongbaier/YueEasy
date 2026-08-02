import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { Track } from '@/core/types';
import { playerService } from '../services/PlayerService';
import { TauriStorage } from '@/tauri/storage';

// ── Helpers ──

/** Format queue count for display: raw number when ≤99, "99+" otherwise. */
export function formatQueueCount(count: number): string {
  return count > 99 ? '99+' : String(count);
}

/** Push service queue state into the Zustand store (must copy the array). */
export function syncQueueDerived(): void {
  useQueueStore.setState({
    queue: [...playerService.queue],
    currentTrack: playerService.currentTrack,
    queueLength: playerService.queueLength,
  });
}

// ── Store ──

export interface QueueStore {
  queue: Track[];
  currentTrack: Track | null;
  queueLength: number;

  play: (track: Track) => Promise<void>;
  replaceAndPlay: (tracks: Track[], startIndex?: number) => Promise<void>;
  next: () => Promise<void>;
  prev: () => Promise<void>;
  addToQueue: (track: Track) => Promise<void>;
  playNext: (track: Track) => Promise<void>;
  playFromIndex: (index: number) => Promise<void>;
  removeFromQueue: (index: number) => Promise<void>;
  clearQueue: () => void;
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
      };
    },
    {
      name: 'player-queue',
      storage: createJSONStorage(() => TauriStorage),
      partialize: (state) => ({
        queue: state.queue,
        index: playerService.currentIndex,
        currentTime: 0, // placeholder — currentTime lives in player store
      }),
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
