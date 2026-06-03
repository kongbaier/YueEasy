import type { PlayContext } from "./strategy/Strategy";

export class PlayQueue<T extends { id: number | string }> {
  #queue: T[] = [];
  activeIndex = -1;

  get isEmpty() {
    return this.length === 0;
  }

  get length() {
    return this.#queue.length;
  }

  get current(): T | undefined {
    return this.#queue[this.activeIndex];
  }

  get context(): PlayContext<T> {
    return { index: this.activeIndex, queue: this.tracks };
  }

  get tracks() {
    return [...this.#queue];
  }

  clear() {
    this.#queue = [];
    this.activeIndex = -1;
  }

  insert(index: number, track: T) {
    if (index < 0 || index > this.#queue.length) {
      throw new RangeError("插入位置越界");
    }
    if (index <= this.activeIndex) {
      this.activeIndex++;
    }
    this.#queue.splice(index, 0, track);
  }

  add(item: T) {
    this.#queue.push(item);
    if (this.activeIndex === -1) {
      this.activeIndex = 0;
    }
  }

  replace(tracks: T[]) {
    this.#queue = tracks;
    if (tracks.length === 0) {
      this.activeIndex = -1;
    } else {
      this.activeIndex = Math.min(
        Math.max(this.activeIndex, 0),
        tracks.length - 1,
      );
    }
  }

  set(tracks: T[], startIndex = 0) {
    this.#queue = tracks;
    if (tracks.length === 0) {
      this.activeIndex = -1;
    } else if (startIndex >= 0 && startIndex < tracks.length) {
      this.activeIndex = startIndex;
    } else {
      this.activeIndex = 0;
    }
  }

  indexOf(id: string | number): number {
    return this.#queue.findIndex((item) => item.id === id);
  }

  remove(id: string | number): boolean {
    const idx = this.indexOf(id);
    if (idx < 0) return false;

    if (idx < this.activeIndex) {
      this.activeIndex--;
    } else if (idx === this.activeIndex) {
      this.activeIndex = Math.min(this.activeIndex, this.#queue.length - 2);
    }

    this.#queue.splice(idx, 1);
    return true;
  }

  [Symbol.iterator]() {
    return this.#queue[Symbol.iterator]();
  }
}
