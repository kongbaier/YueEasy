import { create } from "zustand";
import {
  createPlayModeStrategy,
  PlayerCore,
  SequenceStrategy,
} from "@/core/player";
import type { PlayMode, Track } from "@/core/player/types";
import { resolveUrl } from "@/services/track";

const player = new PlayerCore<Track>(new SequenceStrategy());

let urlFetchedAt = 0;

async function playCurrent() {
  const track = player.currentTrack;
  if (!track) return;
  const url = await resolveUrl(track.id);
  urlFetchedAt = Date.now();
  await player.load(url);
  await player.play();
}

interface PlayerStore {
  core: PlayerCore<Track>;
  currentTrack: Track | null;
  queue: Track[];
  playing: boolean;
  playMode: PlayMode;
  currentTime: number;
  duration: number;
  muted: boolean;
  volume: number;

  play: (track: Track) => Promise<void>;
  replaceAndPlay: (tracks: Track[], startIndex?: number) => Promise<void>;
  pause: () => void;
  resume: () => Promise<void>;
  next: () => Promise<void>;
  prev: () => Promise<void>;
  seek: (time: number) => void;
  setMode: (mode: PlayMode) => void;
  cycleMode: () => void;
  setMuted: (muted: boolean) => void;
  setVolume: (volume: number) => void;
  addToQueue: (track: Track) => Promise<void>;
  playNext: (track: Track) => Promise<void>;
  playFromIndex: (index: number) => Promise<void>;
  removeFromQueue: (index: number) => Promise<void>;
  clearQueue: () => void;
}

export const usePlayerStore = create<PlayerStore>((set, get) => {
  player.on("stateChange", (state) => {
    const wasEnded = state === "ended";
    set({ playing: state === "playing" });
    if (wasEnded) {
      playCurrent().catch(() => player.stop());
    }
  });

  player.on("trackChange", (track) => {
    set({ currentTrack: track ?? null, currentTime: 0, duration: 0 });
  });

  player.on("timeUpdate", (currentTime) => {
    set({ currentTime });
  });

  player.on("durationChange", (duration) => {
    set({ duration });
  });

  return {
    core: player,
    currentTrack: player.currentTrack ?? null,
    queue: player.queue,
    playing: false,
    playMode: "sequential",
    currentTime: 0,
    duration: 0,
    muted: player.muted,
    volume: player.volume,

    play: async (track) => {
      const { currentTrack, queue } = get();
      if (!currentTrack || queue.length === 0) {
        player.setQueue([track], 0);
      } else if (queue.some((item) => item.id === track.id)) {
        player.index = queue.findIndex((t) => t.id === track.id);
      } else {
        player.insert(track, player.index + 1);
        player.index = player.index + 1;
      }
      set({
        queue: player.queue,
        currentTrack: player.currentTrack ?? null,
      });
      await playCurrent();
    },

    replaceAndPlay: async (tracks, startIndex = 0) => {
      player.setQueue(tracks, startIndex);
      set({
        queue: player.queue,
        currentTrack: player.currentTrack ?? null,
      });
      await playCurrent();
    },

    pause: () => player.pause(),

    resume: async () => {
      if (Date.now() - urlFetchedAt > 15 * 60 * 1000) {
        const track = player.currentTrack;
        if (!track) return;
        const savedTime = get().currentTime;
        const url = await resolveUrl(track.id);
        urlFetchedAt = Date.now();
        await player.load(url);
        player.seek(savedTime);
        await player.play();
      } else {
        await player.play();
      }
    },

    next: async () => {
      player.next();
      await playCurrent();
    },

    prev: async () => {
      player.prev();
      await playCurrent();
    },

    seek: (time) => {
      set({ currentTime: time });
      player.seek(time);
    },

    setMode: (mode) => {
      player.mode = createPlayModeStrategy(mode);
      set({ playMode: mode });
    },

    cycleMode: () => {
      const { playMode } = get();
      const next: PlayMode =
        playMode === "sequential"
          ? "shuffle"
          : playMode === "shuffle"
            ? "repeatOne"
            : "sequential";
      player.mode = createPlayModeStrategy(next);
      set({ playMode: next });
    },

    setMuted: (muted) => {
      player.muted = muted;
      set({ muted: player.muted });
    },

    setVolume: (volume) => {
      player.volume = volume;
      set({ volume: player.volume });
    },

    addToQueue: async (track) => {
      const { currentTrack, queue } = get();
      if (queue.some((item) => item.id === track.id)) return;
      if (!currentTrack) {
        player.setQueue([track], 0);
        set({
          queue: player.queue,
          currentTrack: player.currentTrack ?? null,
        });
        await playCurrent();
      } else {
        player.add(track);
        set({ queue: player.queue });
      }
    },

    playNext: async (track) => {
      const { queue, currentTrack } = get();
      if (queue.some((item) => item.id === track.id)) return;

      if (!currentTrack) {
        player.setQueue([track], 0);
        set({
          queue: player.queue,
          currentTrack: player.currentTrack ?? null,
        });
        await playCurrent();
        return;
      }

      const idx = player.index + 1;
      player.insert(track, idx);
      set({ queue: player.queue });
    },

    playFromIndex: async (index) => {
      const queue = player.queue;
      if (index < 0 || index >= queue.length) return;
      player.index = index;
      await playCurrent();
    },

    removeFromQueue: async (index) => {
      const queue = player.queue;
      const track = queue[index];
      if (!track) return;

      const isCurrent = get().currentTrack?.id === track.id;
      player.remove(track.id);

      if (isCurrent) {
        const newQueue = player.queue;
        if (newQueue.length === 0) {
          player.stop();
          set({ queue: [], currentTrack: null });
          return;
        }
        set({
          queue: player.queue,
          currentTrack: player.currentTrack ?? null,
        });
        await playCurrent();
        return;
      }

      set({ queue: player.queue });
    },

    clearQueue: () => {
      player.replace([]);
      player.stop();
      set({ queue: [], currentTrack: null });
    },
  };
});
