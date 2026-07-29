import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { PlayMode, Track } from "../core/types";
import { AudioCore, QueueManager } from "../core";
import { resolveUrl } from "@/shared/services/track";
import { getStoreValue, setStoreValue } from "@/shared/services/store";

// ── Singletons ──

export const audioCore = new AudioCore();
export const queueManager = new QueueManager();

let urlFetchedAt = 0;

export function getUrlFetchedAt(): number {
  return urlFetchedAt;
}
export function setUrlFetchedAt(v: number): void {
  urlFetchedAt = v;
}

// ── Tauri storage adapter for Zustand persist ──

const tauriStorage = {
  getItem: async (name: string): Promise<string | null> => {
    const v = await getStoreValue<string>(name);
    return v ?? null;
  },
  setItem: async (name: string, value: string): Promise<void> => {
    await setStoreValue(name, value);
  },
  removeItem: async (name: string): Promise<void> => {
    await setStoreValue(name, null);
  },
};

// ── Helpers ──

/** Format queue count for display: raw number when ≤99, "99+" otherwise. */
export function formatQueueCount(count: number): string {
  return count > 99 ? "99+" : String(count);
}

/** Push QueueManager state into the Zustand store. */
export function syncQueueDerived(): void {
  useQueueStore.setState({
    queue: [...queueManager.tracks],
    currentTrack: queueManager.currentTrack,
    queueLength: queueManager.length,
  });
}

/** Resolve URL for the current queue track, load audio, and play. */
export async function playCurrent(): Promise<void> {
  const track = queueManager.currentTrack;
  if (!track) return;
  const url = await resolveUrl(track.id);
  urlFetchedAt = Date.now();
  await audioCore.load(url);
  await audioCore.play();
}

// ── Store ──

export interface QueueStore {
  queue: Track[];
  currentTrack: Track | null;
  queueLength: number;
  playMode: PlayMode;

  play: (track: Track) => Promise<void>;
  replaceAndPlay: (tracks: Track[], startIndex?: number) => Promise<void>;
  next: () => Promise<void>;
  prev: () => Promise<void>;
  setMode: (mode: PlayMode) => void;
  cycleMode: () => void;
  addToQueue: (track: Track) => Promise<void>;
  playNext: (track: Track) => Promise<void>;
  playFromIndex: (index: number) => Promise<void>;
  removeFromQueue: (index: number) => Promise<void>;
  clearQueue: () => void;
}

export const useQueueStore = create<QueueStore>()(
  persist(
    (_set, _get) => {
      // Wire ended → auto-advance
      audioCore.on("ended", () => {
        queueManager.advanceOnEnd();
        syncQueueDerived();
        playCurrent().catch(() => audioCore.stop());
      });

      return {
        queue: [],
        currentTrack: null,
        queueLength: 0,
        playMode: "sequential",

        play: async (track) => {
          queueManager.play(track);
          syncQueueDerived();
          await playCurrent();
        },

        replaceAndPlay: async (tracks, startIndex = 0) => {
          queueManager.replace(tracks, startIndex);
          syncQueueDerived();
          await playCurrent();
        },

        next: async () => {
          queueManager.advance();
          syncQueueDerived();
          await playCurrent();
        },

        prev: async () => {
          queueManager.retreat();
          syncQueueDerived();
          await playCurrent();
        },

        setMode: (mode) => {
          queueManager.setMode(mode);
          useQueueStore.setState({ playMode: mode });
        },

        cycleMode: () => {
          const next = queueManager.cycleMode();
          useQueueStore.setState({ playMode: next });
        },

        addToQueue: async (track) => {
          const wasEmpty = queueManager.length === 0;
          queueManager.append(track);
          syncQueueDerived();
          if (wasEmpty) await playCurrent();
        },

        playNext: async (track) => {
          const wasEmpty = queueManager.length === 0;
          queueManager.insertNext(track);
          syncQueueDerived();
          if (wasEmpty) await playCurrent();
        },

        playFromIndex: async (index) => {
          if (!queueManager.select(index)) return;
          syncQueueDerived();
          await playCurrent();
        },

        removeFromQueue: async (index) => {
          const wasCurrent = queueManager.removeAt(index);
          syncQueueDerived();
          if (wasCurrent) {
            if (queueManager.length === 0) {
              audioCore.stop();
              return;
            }
            await playCurrent();
          }
        },

        clearQueue: () => {
          queueManager.clear();
          audioCore.stop();
          syncQueueDerived();
        },
      };
    },
    {
      name: "player-queue",
      storage: createJSONStorage(() => tauriStorage),
      partialize: (state) => ({
        queue: state.queue,
        playMode: state.playMode,
        index: queueManager.currentIndex,
        currentTime: 0, // placeholder — currentTime lives in player store
      }),
      onRehydrateStorage: () => (state) => {
        const data = state as { queue?: Track[]; playMode?: PlayMode; index?: number } | undefined;
        if (data?.queue?.length) {
          queueManager.replace(data.queue, data.index ?? 0);
          if (data.playMode) queueManager.setMode(data.playMode);
          // Re-sync Zustand from QueueManager
          syncQueueDerived();
        }
      },
    },
  ),
);
