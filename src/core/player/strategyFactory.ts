import { RepeatOneStrategy } from "./RepeatOneStrategy";
import { SequenceStrategy } from "./SequenceStrategy";
import { ShuffleStrategy } from "./ShuffleStrategy";
import type { PlayModeStrategy } from "./Strategy";
import type { PlayMode } from "./types";

export function createPlayModeStrategy(
  mode: PlayMode,
): PlayModeStrategy<{ id: number; url: string }> {
  switch (mode) {
    case "sequential":
      return new SequenceStrategy();
    case "shuffle":
      return new ShuffleStrategy();
    case "repeatOne":
      return new RepeatOneStrategy();
  }
}
