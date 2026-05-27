import { create } from "zustand";
import { PlayerCore } from "@/core/player";
import type { PlayerState, PlayMode, Track } from "@/core/player/types";

interface PlayerStore {
  core: PlayerCore;
  currentTrack: Track | null;
  queue: Track[];
  state: PlayerState;
  mode: PlayMode;
  currentTime: number;
  duration: number;

  play: (track: Track) => void;
  pause: () => void;
  resume: () => void;
  next: () => void;
  prev: () => void;
  addToQueue: (tracks: Track[]) => void;
  removeFromQueue: (index: number) => void;
  setMode: (mode: PlayMode) => void;
  seek: (time: number) => void;
}

const playerCore = new PlayerCore();

export const usePlayerStore = create<PlayerStore>((set, _get) => {
  playerCore.on("stateChange", (state: PlayerState) => set({ state }));
  playerCore.on("trackChange", (track: Track | null) =>
    set({ currentTrack: track }),
  );
  playerCore.on("queueChange", (queue: Track[]) => set({ queue }));
  playerCore.on("modeChange", (mode: PlayMode) => set({ mode }));
  playerCore.on("progress", (current: number, duration: number) =>
    set({ currentTime: current, duration }),
  );

  return {
    core: playerCore,
    currentTrack: null,
    queue: [],
    state: "idle" as PlayerState,
    mode: "sequential" as PlayMode,
    currentTime: 0,
    duration: 0,

    play: (track) => playerCore.load(track),
    pause: () => playerCore.pause(),
    resume: () => playerCore.resume(),
    next: () => playerCore.next(),
    prev: () => playerCore.prev(),
    addToQueue: (tracks) => playerCore.addToQueue(tracks),
    removeFromQueue: (index) => playerCore.removeFromQueue(index),
    setMode: (mode) => playerCore.setMode(mode),
    seek: (time) => playerCore.seek(time),
  };
});
