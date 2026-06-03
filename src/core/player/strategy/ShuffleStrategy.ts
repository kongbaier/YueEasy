import type { PlayMode } from "../types";
import type { PlayContext, PlayModeStrategy } from "./Strategy";

export class ShuffleStrategy<T> implements PlayModeStrategy<T> {
  name: PlayMode = "shuffle";
  #shuffledQueue: number[] = [];
  #shuffleIndex: number = -1;

  next(): number {
    if (this.#shuffleIndex === -1) {
      throw new Error("随机播放模式未初始化");
    }
    this.#shuffleIndex = (this.#shuffleIndex + 1) % this.#shuffledQueue.length;
    return this.#shuffledQueue[this.#shuffleIndex];
  }

  prev(): number {
    if (this.#shuffleIndex === -1) {
      throw new Error("随机播放模式未初始化");
    }
    this.#shuffleIndex =
      (this.#shuffleIndex - 1 + this.#shuffledQueue.length) %
      this.#shuffledQueue.length;
    return this.#shuffledQueue[this.#shuffleIndex];
  }

  ended(): number {
    return this.next();
  }

  init(ctx: PlayContext<T>) {
    this.#shuffledQueue = this.#shuffleByIndex(ctx.queue.length);
    this.#syncShuffleIndex(ctx.index);
  }

  destroy(): void {
    this.#shuffledQueue = [];
    this.#shuffleIndex = -1;
  }

  #shuffleByIndex(length: number) {
    const result = Array.from({ length }, (_, index) => index);

    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }

    return result;
  }

  #syncShuffleIndex(currentIndex: number) {
    if (currentIndex === -1) {
      this.#shuffleIndex = -1;
      return;
    }

    this.#shuffleIndex = this.#shuffledQueue.indexOf(currentIndex);

    if (this.#shuffleIndex === -1) {
      this.#shuffleIndex = this.#shuffledQueue.length > 0 ? 0 : -1;
    }
  }
}
