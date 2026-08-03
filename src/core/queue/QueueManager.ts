import type { Track } from '../types';
import type { PlayMode } from '../types';

// ── Queue source ──

/** Where the current queue content comes from. FM is a queue source, not a play mode. */
export type QueueSource = 'list' | 'fm';

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
  #source: QueueSource = 'list';
  // 进入漫游前的队列快照：退出漫游时原样恢复（音频进度由上层 PlayerService 保管）
  #fmSnapshot: {
    tracks: Track[];
    currentIndex: number;
    mode: PlayMode;
    strategy: QueueStrategy;
  } | null = null;

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

  get source(): QueueSource {
    return this.#source;
  }

  get isFm(): boolean {
    return this.#source === 'fm';
  }

  /** In FM mode, prev is only allowed when not at the very first song. */
  get canPrev(): boolean {
    if (this.#source === 'fm') return this.#currentIndex > 0;
    return true;
  }

  get isAtEnd(): boolean {
    return (
      this.#tracks.length === 0 ||
      this.#currentIndex >= this.#tracks.length - 1
    );
  }

  /** 退出漫游是否会清空队列（进入漫游前无队列快照时可恢复，不会清空）。 */
  get fmExitWillEmpty(): boolean {
    return this.#source === 'fm' && this.#fmSnapshot === null;
  }

  // ── Queue mutations ──

  /** Replace entire queue and start playing from startIndex */
  replace(tracks: Track[], startIndex?: number): void {
    // 整批替换 = 重新选择播放源，退出漫游
    this.#source = 'list';
    this.#fmSnapshot = null; // 用户主动选择新源，放弃漫游快照
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
    // 用户主动点歌 = 退出漫游，回到列表语义
    this.#source = 'list';
    this.#fmSnapshot = null; // 用户主动点歌，放弃漫游快照
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
    // 清空 = 退出漫游
    this.#source = 'list';
    this.#fmSnapshot = null; // 主动清空，放弃漫游快照
    this.#tracks = [];
    this.#currentIndex = -1;
    // No need to re-create strategy — it will handle length===0 gracefully
  }

  /** Switch the queue into FM mode and start from the first given song. */
  enterFm(tracks: Track[]): void {
    // 进入漫游前快照当前队列；已在漫游中再次进入不覆盖已有快照
    if (this.#source !== 'fm') {
      this.#fmSnapshot =
        this.#tracks.length > 0
          ? {
              tracks: [...this.#tracks],
              currentIndex: this.#currentIndex,
              mode: this.#mode,
              strategy: this.#strategy,
            }
          : null;
    }
    this.#source = 'fm';
    this.#tracks = [...tracks];
    this.#currentIndex = tracks.length > 0 ? 0 : -1;
  }

  /**
   * Leave FM mode. If a pre-FM queue snapshot exists, restore it as-is
   * (tracks, position, play mode & strategy); otherwise empty the queue.
   * Returns the restored snapshot (or null) so the caller can resume the
   * audio at its saved position.
   */
  exitFm(): {
    tracks: Track[];
    currentIndex: number;
    mode: PlayMode;
    strategy: QueueStrategy;
  } | null {
    const snapshot = this.#fmSnapshot;
    this.#fmSnapshot = null;
    this.#source = 'list';
    if (snapshot) {
      this.#tracks = [...snapshot.tracks];
      this.#currentIndex = snapshot.currentIndex;
      this.#mode = snapshot.mode;
      this.#strategy = snapshot.strategy;
    } else {
      this.#tracks = [];
      this.#currentIndex = -1;
    }
    return snapshot;
  }

  /**
   * Append many tracks to the end of the queue (dupe-safe, reuses append's
   * dedup logic). Returns the number of tracks actually added.
   */
  appendMany(tracks: Track[]): number {
    const before = this.#tracks.length;
    for (const track of tracks) {
      this.append(track);
    }
    return this.#tracks.length - before;
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
    if (this.#source === 'fm') {
      // FM never wraps around — caller is expected to refill at the end.
      if (this.isAtEnd) return this.#currentIndex;
      this.#currentIndex++;
      return this.#currentIndex;
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
    if (this.#source === 'fm') {
      // FM cannot go before the first song.
      if (this.#currentIndex === 0) return 0;
      this.#currentIndex--;
      return this.#currentIndex;
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
    if (this.#source === 'fm') {
      // Same semantics as advance's FM branch — never wrap around.
      if (this.isAtEnd) return this.#currentIndex;
      this.#currentIndex++;
      return this.#currentIndex;
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
