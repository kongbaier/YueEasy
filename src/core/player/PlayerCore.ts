import type { PlayerState, PlayMode, Track } from "./types";

// biome-ignore lint/suspicious/noExplicitAny: event system payloads vary by event type
type EventHandler = (...args: any[]) => void;

export class PlayerCore {
  private queue: Track[] = [];
  private currentIndex = -1;
  private _state: PlayerState = "idle";
  private _mode: PlayMode = "sequential";
  private _volume = 1;
  private _currentTime = 0;
  private _duration = 0;
  private listeners = new Map<string, Set<EventHandler>>();
  private shuffleIndices: number[] = [];

  on(event: string, handler: EventHandler): void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)?.add(handler);
  }

  off(event: string, handler: EventHandler): void {
    this.listeners.get(event)?.delete(handler);
  }

  private emit(event: string, ...args: unknown[]): void {
    this.listeners.get(event)?.forEach((h) => {
      h(...args);
    });
  }

  get state(): PlayerState {
    return this._state;
  }
  get mode(): PlayMode {
    return this._mode;
  }
  get volume(): number {
    return this._volume;
  }

  get currentTrack(): Track | null {
    if (this.currentIndex < 0 || this.currentIndex >= this.queue.length)
      return null;
    return this.queue[this.currentIndex];
  }

  get queueList(): Track[] {
    return [...this.queue];
  }

  get progress(): { current: number; duration: number } {
    return { current: this._currentTime, duration: this._duration };
  }

  load(track: Track): void {
    this.addToQueue([track]);
    this.currentIndex = this.queue.length - 1;
    this._currentTime = 0;
    this._duration = track.duration || 0;
    this.setState("loading");
    this.emit("trackChange", track);
    this.emit("queueChange", this.queueList);
  }

  play(): void {
    if (!this.currentTrack) return;
    this.setState("playing");
  }

  pause(): void {
    this.setState("paused");
  }

  resume(): void {
    if (!this.currentTrack) return;
    this.setState("playing");
  }

  next(): Track | null {
    if (this.queue.length === 0) return null;
    const nextIdx = this.getNextIndex();
    if (nextIdx === -1) return null;
    this.currentIndex = nextIdx;
    const track = this.queue[this.currentIndex];
    this._currentTime = 0;
    this.setState("loading");
    this.emit("trackChange", track);
    this.emit("queueChange", this.queueList);
    return track;
  }

  prev(): Track | null {
    if (this.queue.length === 0) return null;
    if (this._currentTime > 3) {
      this._currentTime = 0;
      this.emit("seek", 0);
      return this.currentTrack;
    }
    const prevIdx = this.getPrevIndex();
    if (prevIdx === -1) return null;
    this.currentIndex = prevIdx;
    const track = this.queue[this.currentIndex];
    this._currentTime = 0;
    this.setState("loading");
    this.emit("trackChange", track);
    this.emit("queueChange", this.queueList);
    return track;
  }

  addToQueue(tracks: Track[]): void {
    this.queue.push(...tracks);
    this.rebuildShuffle();
    this.emit("queueChange", this.queueList);
  }

  removeFromQueue(index: number): void {
    if (index < 0 || index >= this.queue.length) return;
    this.queue.splice(index, 1);
    if (index < this.currentIndex) this.currentIndex--;
    else if (index === this.currentIndex) this.next();
    this.rebuildShuffle();
    this.emit("queueChange", this.queueList);
  }

  clearQueue(): void {
    this.queue = [];
    this.currentIndex = -1;
    this.shuffleIndices = [];
    this.setState("idle");
    this.emit("queueChange", this.queueList);
  }

  setMode(mode: PlayMode): void {
    if (this._mode === mode) return;
    this._mode = mode;
    if (mode === "shuffle") this.rebuildShuffle();
    this.emit("modeChange", mode);
  }

  setVolume(volume: number): void {
    this._volume = Math.max(0, Math.min(1, volume));
    this.emit("volumeChange", this._volume);
  }

  seek(time: number): void {
    this._currentTime = Math.max(0, Math.min(time, this._duration));
    this.emit("seek", this._currentTime);
  }

  onTimeUpdate(current: number, duration: number): void {
    this._currentTime = current;
    this._duration = duration || this._duration;
    this.emit("progress", this._currentTime, this._duration);
  }

  onEnded(): void {
    const nextTrack = this.next();
    if (!nextTrack) {
      this.setState("paused");
      this._currentTime = 0;
    }
  }

  onError(): void {
    this.setState("error");
  }

  private setState(state: PlayerState): void {
    if (this._state === state) return;
    this._state = state;
    this.emit("stateChange", state);
  }

  private getNextIndex(): number {
    if (this.queue.length === 0) return -1;
    switch (this._mode) {
      case "repeatOne":
        return this.currentIndex;
      case "repeat":
        return (this.currentIndex + 1) % this.queue.length;
      case "shuffle": {
        if (this.shuffleIndices.length === 0) return -1;
        const shuffleIdx = this.shuffleIndices.indexOf(this.currentIndex);
        if (shuffleIdx === -1) return this.currentIndex;
        return this.shuffleIndices[
          (shuffleIdx + 1) % this.shuffleIndices.length
        ];
      }
      default: {
        const next = this.currentIndex + 1;
        return next < this.queue.length ? next : -1;
      }
    }
  }

  private getPrevIndex(): number {
    if (this.queue.length === 0) return -1;
    switch (this._mode) {
      case "repeatOne":
        return this.currentIndex;
      case "repeat":
        return (this.currentIndex - 1 + this.queue.length) % this.queue.length;
      case "shuffle": {
        if (this.shuffleIndices.length === 0) return -1;
        const shuffleIdx = this.shuffleIndices.indexOf(this.currentIndex);
        if (shuffleIdx === -1) return this.currentIndex;
        const len = this.shuffleIndices.length;
        return this.shuffleIndices[(shuffleIdx - 1 + len) % len];
      }
      default: {
        const prev = this.currentIndex - 1;
        return prev >= 0 ? prev : -1;
      }
    }
  }

  private rebuildShuffle(): void {
    this.shuffleIndices = this.queue.map((_, i) => i);
    for (let i = this.shuffleIndices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.shuffleIndices[i], this.shuffleIndices[j]] = [
        this.shuffleIndices[j],
        this.shuffleIndices[i],
      ];
    }
  }
}
