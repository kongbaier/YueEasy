import { RepeatOneStrategy } from "./strategy/RepeatOneStrategy";
import { SequenceStrategy } from "./strategy/SequenceStrategy";
import { ShuffleStrategy } from "./strategy/ShuffleStrategy";
import type { PlayModeStrategy } from "./strategy/Strategy";
import type { PlayMode } from "./types";

export function createPlayModeStrategy(
  mode: PlayMode,
): PlayModeStrategy<{ id: number }> {
  switch (mode) {
    case "sequential":
      return new SequenceStrategy();
    case "shuffle":
      return new ShuffleStrategy();
    case "repeatOne":
      return new RepeatOneStrategy();
  }
}
