import { create } from "zustand";
import {
  createPlayModeStrategy,
  PlayerCore,
  SequenceStrategy,
} from "@/core/player";
import type { PlayMode, Track } from "@/core/player/types";

const player = new PlayerCore<Track>(new SequenceStrategy());

interface PlayerStore {
  core: PlayerCore<Track>;
  currentTrack: Track | null;
  queue: Track[];
  playing: boolean;
  playMode: PlayMode;
  currentTime: number;
  preciseCurrentTime: number;
  duration: number;
  muted: boolean;
  volume: number;

  play: (track: Track) => void;
  pause: () => void;
  resume: () => void;
  next: () => void;
  prev: () => void;
  seek: (time: number) => void;
  setMode: (mode: PlayMode) => void;
  cycleMode: () => void;
  setMuted: (muted: boolean) => void;
  setVolume: (volume: number) => void;
  addToQueue: (track: Track) => void;
  playNext: (track: Track) => void;
  playFromIndex: (index: number) => void;
  removeFromQueue: (index: number) => void;
  clearQueue: () => void;
}

export const usePlayerStore = create<PlayerStore>((set, get) => {
  player.on("timeupdate", (currentTime) => {
    set({ currentTime });
  });

  player.on("precisetimeupdate", (preciseCurrentTime) => {
    set({ preciseCurrentTime });
  });

  player.on("loadedmetadata", (duration) => {
    set({ duration });
  });

  player.on("play", () => {
    set({
      currentTrack: player.currentTrack ?? null,
      playing: true,
    });
  });

  player.on("pause", () => {
    set({ playing: false });
  });

  return {
    core: player,
    currentTrack: player.currentTrack ?? null,
    queue: player.queue,
    playing: false,
    playMode: "sequential",
    currentTime: 0,
    preciseCurrentTime: 0,
    duration: 0,
    muted: player.muted,
    volume: player.volume,

    play: (track) => {
      player.setQueue([track], 0);
      player.load();
      player.play();
      set({ queue: player.queue });
    },

    pause: () => player.pause(),
    resume: () => player.play(),

    next: () => player.next(),
    prev: () => player.prev(),

    seek: (time) => {
      set({ currentTime: time, preciseCurrentTime: time });
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

    addToQueue: (track) => {
      const { currentTrack, queue } = get();
      if (queue.some((item) => item.id === track.id)) return;
      if (!currentTrack) {
        player.setQueue([track], 0);
        player.play();
      } else {
        player.add(track);
      }
      set({ queue: player.queue });
    },

    playNext: (track) => {
      const { queue } = get();
      if (queue.some((item) => item.id === track.id)) return;
      const idx = player.index + 1;
      player.insert(track, idx);
      set({ queue: player.queue });
    },

    playFromIndex: (index) => {
      const queue = player.queue;
      if (index < 0 || index >= queue.length) return;
      player.index = index;
      player.load();
      player.play();
    },

    removeFromQueue: (index) => {
      const queue = player.queue;
      const track = queue[index];
      if (!track) return;

      const isCurrent = get().currentTrack?.id === track.id;
      player.remove(track.id);

      if (isCurrent) {
        const newQueue = player.queue;
        if (newQueue.length === 0) {
          player.pause();
          set({ queue: [], currentTrack: null });
          return;
        }
        player.play();
      }

      set({ queue: player.queue });
    },

    clearQueue: () => {
      player.replace([]);
      player.pause();
      set({ queue: [], currentTrack: null });
    },
  };
});
