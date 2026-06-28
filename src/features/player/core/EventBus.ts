import type { PlayerState } from "./types";

export type PlayerEvents<T> = {
  stateChange: (state: PlayerState) => void;
  trackChange: (track: T | undefined) => void;
  timeUpdate: (currentTime: number) => void;
  durationChange: (duration: number) => void;
};
