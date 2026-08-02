import type { Track } from '../types';
import type { PlayMode } from '../types';

// ── Internal strategy interface ──

interface QueueStrategy {
  next(current: number, length: number): number;
  prev(current: number, length: number): number;
  onEnd(current: number, length: number): number;
}

// ── Strategy implementations ──

class SequentialStrategy implements QueueStrategy {
  next(current: number, length: number): number {
    return (current + 1) % length;
  }

  prev(current: number, length: number): number {
    return (current - 1 + length) % length;
  }

  onEnd(current: number, length: number): number {
    return this.next(current, length);
  }
}

class RepeatOneStrategy implements QueueStrategy {
  next(_current: number, _length: number): number {
    return _current;
  }

  prev(_current: number, _length: number): number {
    return _current;
  }

  onEnd(_current: number, _length: number): number {
    return _current;
  }
}

class ShuffleStrategy implements QueueStrategy {
  #shuffled: number[];
  #position: number;

  constructor(current: number, length: number) {
    this.#shuffled = ShuffleStrategy.#fisherYates(length);
    this.#position = length > 0 ? this.#shuffled.indexOf(current) : -1;
    if (this.#position === -1 && length > 0) {
      this.#position = 0;
    }
  }

  next(_current: number, length: number): number {
    this.#position = (this.#position + 1) % length;
    return this.#shuffled[this.#position];
  }

  prev(_current: number, length: number): number {
    this.#position = (this.#position - 1 + length) % length;
    return this.#shuffled[this.#position];
  }

  onEnd(current: number, length: number): number {
    return this.next(current, length);
  }

  static #fisherYates(length: number): number[] {
    const arr = Array.from({ length }, (_, i) => i);
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
}

// ── QueueManager ──

export class QueueManager {
  #tracks: Track[];
  #currentIndex: number;
  #mode: PlayMode;
  #strategy: QueueStrategy;

  constructor(tracks?: Track[], startIndex?: number, mode?: PlayMode) {
    this.#tracks = [];
    this.#currentIndex = -1;
    this.#mode = 'sequential';
    this.#strategy = new SequentialStrategy();

    if (tracks && tracks.length > 0) {
      this.#tracks = [...tracks];
      const idx = startIndex ?? 0;
      this.#currentIndex = Math.max(0, Math.min(idx, this.#tracks.length - 1));
      this.#mode = mode ?? 'sequential';
      this.#strategy = this.#createStrategy(
        this.#mode,
        this.#currentIndex,
        this.#tracks.length,
      );
    }
  }

  // ── State accessors ──

  get tracks(): readonly Track[] {
    return this.#tracks;
  }

  get currentIndex(): number {
    return this.#currentIndex;
  }

  get currentTrack(): Track | null {
    return this.#tracks[this.#currentIndex] ?? null;
  }

  get length(): number {
    return this.#tracks.length;
  }

  get mode(): PlayMode {
    return this.#mode;
  }

  // ── Queue mutations ──

  /** Replace entire queue and start playing from startIndex */
  replace(tracks: Track[], startIndex?: number): void {
    this.#tracks = [...tracks];

    if (this.#tracks.length === 0) {
      this.#currentIndex = -1;
      this.#strategy = this.#createStrategy(this.#mode, -1, 0);
      return;
    }

    const idx = startIndex ?? 0;
    this.#currentIndex = Math.max(0, Math.min(idx, this.#tracks.length - 1));
    this.#strategy = this.#createStrategy(
      this.#mode,
      this.#currentIndex,
      this.#tracks.length,
    );
  }

  /**
   * Play a track: if already in queue, jump to it; otherwise insert after
   * current and jump to the new track.
   */
  play(track: Track): void {
    const existingIndex = this.#tracks.findIndex((t) => t.id === track.id);

    if (existingIndex >= 0) {
      this.#currentIndex = existingIndex;
      return;
    }

    if (this.#tracks.length === 0) {
      this.#tracks = [track];
      this.#currentIndex = 0;
      return;
    }

    // Insert after current and jump to it
    this.#tracks.splice(this.#currentIndex + 1, 0, track);
    this.#currentIndex++;
  }

  /** Append track to end of queue (dupe-safe). If queue is empty, auto-play it. */
  append(track: Track): void {
    if (this.#tracks.some((t) => t.id === track.id)) return;

    if (this.#tracks.length === 0) {
      this.#tracks = [track];
      this.#currentIndex = 0;
      return;
    }

    this.#tracks.push(track);
  }

  /** Insert track right after current (dupe-safe). If queue is empty, auto-play it. */
  insertNext(track: Track): void {
    if (this.#tracks.some((t) => t.id === track.id)) return;

    if (this.#tracks.length === 0) {
      this.#tracks = [track];
      this.#currentIndex = 0;
      return;
    }

    this.#tracks.splice(this.#currentIndex + 1, 0, track);
  }

  /** Remove track at index. Returns true if the current track was removed. */
  removeAt(index: number): boolean {
    if (index < 0 || index >= this.#tracks.length) return false;

    const wasCurrent = index === this.#currentIndex;

    this.#tracks.splice(index, 1);

    if (this.#tracks.length === 0) {
      this.#currentIndex = -1;
      return wasCurrent;
    }

    if (index < this.#currentIndex) {
      this.#currentIndex--;
    } else if (index === this.#currentIndex) {
      // Stay at same index (next track slides into place) and clamp
      this.#currentIndex = Math.min(index, this.#tracks.length - 1);
    }
    // If index > currentIndex, no adjustment needed

    return wasCurrent;
  }

  /** Clear the entire queue */
  clear(): void {
    this.#tracks = [];
    this.#currentIndex = -1;
    // No need to re-create strategy — it will handle length===0 gracefully
  }

  /** Jump to a specific index. Returns false if index is invalid. */
  select(index: number): boolean {
    if (index < 0 || index >= this.#tracks.length) return false;
    this.#currentIndex = index;
    return true;
  }

  // ── Navigation ──

  /** Advance to the next track according to play mode. Updates and returns the new index. */
  advance(): number {
    if (this.#tracks.length === 0) {
      this.#currentIndex = -1;
      return -1;
    }
    this.#currentIndex = this.#strategy.next(
      this.#currentIndex,
      this.#tracks.length,
    );
    return this.#currentIndex;
  }

  /** Retreat to the previous track according to play mode. Updates and returns the new index. */
  retreat(): number {
    if (this.#tracks.length === 0) {
      this.#currentIndex = -1;
      return -1;
    }
    this.#currentIndex = this.#strategy.prev(
      this.#currentIndex,
      this.#tracks.length,
    );
    return this.#currentIndex;
  }

  /** Called when the current track ends naturally. Updates and returns the new index. */
  advanceOnEnd(): number {
    if (this.#tracks.length === 0) {
      this.#currentIndex = -1;
      return -1;
    }
    this.#currentIndex = this.#strategy.onEnd(
      this.#currentIndex,
      this.#tracks.length,
    );
    return this.#currentIndex;
  }

  // ── Mode ──

  /** Set play mode. Re-initializes the internal strategy. */
  setMode(mode: PlayMode): void {
    this.#mode = mode;
    this.#strategy = this.#createStrategy(
      mode,
      this.#currentIndex,
      this.#tracks.length,
    );
  }

  /** Cycle sequential → shuffle → repeatOne → sequential. Returns the new mode. */
  cycleMode(): PlayMode {
    const next: PlayMode =
      this.#mode === 'sequential'
        ? 'shuffle'
        : this.#mode === 'shuffle'
          ? 'repeatOne'
          : 'sequential';
    this.#mode = next;
    this.#strategy = this.#createStrategy(
      next,
      this.#currentIndex,
      this.#tracks.length,
    );
    return next;
  }

  // ── Internal helpers ──

  #createStrategy(
    mode: PlayMode,
    current: number,
    length: number,
  ): QueueStrategy {
    switch (mode) {
      case 'shuffle':
        return new ShuffleStrategy(current, length);
      case 'repeatOne':
        return new RepeatOneStrategy();
      case 'sequential':
      default:
        return new SequentialStrategy();
    }
  }
}
