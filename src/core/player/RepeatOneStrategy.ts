import type { PlayContext, PlayModeStrategy } from "./Strategy";
import type { PlayMode } from "./types";

export class RepeatOneStrategy<T> implements PlayModeStrategy<T> {
  name: PlayMode = "repeatOne";

  next(ctx: PlayContext<T>): number {
    return (ctx.index + 1) % ctx.queue.length;
  }

  ended(ctx: PlayContext<T>) {
    return ctx.index;
  }

  prev(ctx: PlayContext<T>): number {
    return (ctx.index - 1 + ctx.queue.length) % ctx.queue.length;
  }
}
