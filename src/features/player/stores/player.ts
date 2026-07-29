import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { resolveUrl } from "@/shared/services/track";
import { getStoreValue, setStoreValue } from "@/shared/services/store";
import {
  audioCore,
  queueManager,
  getUrlFetchedAt,
  setUrlFetchedAt,
} from "./queue";

// ── Tauri storage adapter ──

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

// ── Store ──

export interface PlayerStore {
  playing: boolean;
  loading: boolean;
  currentTime: number;
  currentTimeHigh: number;
  duration: number;
  volume: number;
  muted: boolean;

  pause: () => void;
  resume: () => Promise<void>;
  seek: (time: number) => void;
  setVolume: (v: number) => void;
  setMuted: (m: boolean) => void;
}

export const usePlayerStore = create<PlayerStore>()(
  persist(
    (set, get) => {
      // ── Wire audioCore playback events ──

      audioCore.on("play", () => set({ playing: true }));
      audioCore.on("pause", () => set({ playing: false }));
      audioCore.on("ended", () => set({ playing: false }));
      audioCore.on("loading", () => set({ loading: true }));
      audioCore.on("ready", () => set({ loading: false }));
      audioCore.on("error", () => set({ loading: false, playing: false }));

      audioCore.on("timeupdate", (currentTime) => {
        set({ currentTime });
      });

      audioCore.on("timetick", (currentTimeHigh) => {
        set({ currentTimeHigh });
      });

      audioCore.on("durationchange", (duration) => {
        set({ duration });
      });

      return {
        playing: false,
        loading: false,
        currentTime: 0,
        currentTimeHigh: 0,
        duration: 0,
        volume: 1,
        muted: false,

        pause: () => {
          audioCore.pause();
          set({ playing: false });
        },

        resume: async () => {
          if (Date.now() - getUrlFetchedAt() > 15 * 60 * 1000) {
            const { currentTime } = get();
            const track = queueManager.currentTrack;
            if (!track) return;
            const url = await resolveUrl(track.id);
            setUrlFetchedAt(Date.now());
            await audioCore.load(url);
            audioCore.seek(currentTime);
            await audioCore.play();
          } else {
            await audioCore.play();
          }
          // Defensive set() guards against rehydration timing races.
          set({ playing: true });
        },

        seek: (time) => {
          set({ currentTime: time });
          audioCore.seek(time);
        },

        setVolume: (v) => {
          audioCore.volume = v;
          set({ volume: v, muted: false });
        },

        setMuted: (m) => {
          audioCore.muted = m;
          set({ muted: m });
        },
      };
    },
    {
      name: "player",
      storage: createJSONStorage(() => tauriStorage),
      partialize: (state) => ({
        volume: state.volume,
        muted: state.muted,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          audioCore.volume = (state as { volume?: number }).volume ?? 1;
          audioCore.muted = (state as { muted?: boolean }).muted ?? false;
        }
      },
    },
  ),
);
