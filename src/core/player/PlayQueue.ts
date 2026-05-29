export class PlayQueue<T extends { id: number | string }> {
  #queue: T[] = [];

  get isEmpty() {
    return this.length === 0;
  }

  get length() {
    return this.#queue.length;
  }

  clear() {
    this.#queue = [];
  }

  insert(index: number, track: T) {
    if (index < 0 || index > this.#queue.length) {
      throw new RangeError("插入位置越界");
    }
    this.#queue.splice(index, 0, track);
  }

  add(item: T) {
    this.#queue.push(item);
  }

  replace(queue: T[]) {
    this.#queue = queue;
  }

  indexOf(id: string | number): number {
    return this.#queue.findIndex((item) => String(item.id) === String(id));
  }

  remove(id: string | number) {
    const index = this.indexOf(id);
    if (index < 0) return;

    this.#queue.splice(index, 1);
  }

  [Symbol.iterator]() {
    return this.#queue[Symbol.iterator]();
  }

  get tracks() {
    return [...this.#queue];
  }
}
