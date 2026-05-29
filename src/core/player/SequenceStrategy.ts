import type { PlayContext, PlayModeStrategy } from "./Strategy";
import type { PlayMode } from "./types";

export class SequenceStrategy<T> implements PlayModeStrategy<T> {
  name: PlayMode = "sequential";

  next(ctx: PlayContext<T>): number {
    return (ctx.index + 1) % ctx.queue.length;
  }

  ended(ctx: PlayContext<T>) {
    return this.next(ctx);
  }

  prev(ctx: PlayContext<T>): number {
    return (ctx.index - 1 + ctx.queue.length) % ctx.queue.length;
  }
}
