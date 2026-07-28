import type { PlayMode } from "../types";
import type { PlayContext } from "./Strategy";
import { SequenceStrategy } from "./SequenceStrategy";

export class RepeatOneStrategy<T> extends SequenceStrategy<T> {
  name: PlayMode = "repeatOne";

  ended(ctx: PlayContext<T>) {
    return ctx.index;
  }
}
