import type { PlayMode } from "../types";

export type PlayContext<T> = {
  index: number;
  queue: T[];
};

export interface PlayModeStrategy<T> {
  name: PlayMode;
  next(ctx: PlayContext<T>): number;
  prev(ctx: PlayContext<T>): number;
  ended(ctx: PlayContext<T>): number;
  init?(ctx: PlayContext<T>): void;
  destroy?(): void;
}
