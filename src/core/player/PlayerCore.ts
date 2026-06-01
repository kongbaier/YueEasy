import type { AudioEvents } from "./AudioEngine";
import { AudioEngine } from "./AudioEngine";
import { PlayQueue } from "./PlayQueue";
import { StateMachine } from "./StateMachine";
import type { PlayModeStrategy } from "./Strategy";
import type { PlayerState } from "./types";

export class PlayerCore<T extends { id: number; url: string }> {
  index = -1;
  #queue: PlayQueue<T>;
  #engine: AudioEngine;
  #strategy: PlayModeStrategy<T>;
  #stateMachine: StateMachine;
  #stateListeners = new Set<(state: PlayerState) => void>();

  constructor(mode: PlayModeStrategy<T>) {
    this.#queue = new PlayQueue();
    this.#engine = new AudioEngine();
    this.#stateMachine = new StateMachine();
    this.#strategy = mode;

    this.#bindEvents();
  }

  get state(): PlayerState {
    return this.#stateMachine.state;
  }

  onStateChange(cb: (state: PlayerState) => void) {
    this.#stateListeners.add(cb);
    return () => {
      this.#stateListeners.delete(cb);
    };
  }

  #transition(to: PlayerState): boolean {
    if (!this.#stateMachine.transition(to)) return false;
    for (const cb of this.#stateListeners) {
      cb(to);
    }
    return true;
  }

  initialize(prefs: {
    volume: number;
    muted: boolean;
    mode: PlayModeStrategy<T>;
  }) {
    this.volume = prefs.volume;
    this.muted = prefs.muted;
    this.mode = prefs.mode;
  }

  load() {
    const track = this.currentTrack;
    if (!track) return;
    if (!this.#transition("loading")) return;

    this.#engine.load(track.url);
  }

  #bindEvents() {
    this.#engine.on("canPlay", () => {
      this.#transition("ready");
    });
    this.#engine.on("ended", () => {
      this.#transition("ended");
      this.ended();
    });
  }

  async play() {
    const track = this.currentTrack;
    if (!track) return;

    if (this.#engine.currentSrc !== track.url) {
      this.load();
      if (this.state === "loading") {
        await new Promise<void>((resolve) => {
          const off = this.#engine.on("canPlay", () => {
            off();
            resolve();
          });
        });
      }
    }

    try {
      await this.#engine.play();
      this.#transition("playing");
    } catch (_err) {
      this.#transition("error");
    }
  }

  pause() {
    this.#engine.pause();
    this.#transition("paused");
  }

  next() {
    this.index = this.#strategy.next({
      index: this.index,
      queue: this.#queue.tracks,
    });
    this.load();
    this.play();
  }

  prev() {
    this.index = this.#strategy.prev({
      index: this.index,
      queue: this.#queue.tracks,
    });
    this.load();
    this.play();
  }

  ended() {
    this.index = this.#strategy.ended({
      index: this.index,
      queue: this.#queue.tracks,
    });
    this.load();
    this.play();
  }

  seek(time: number) {
    this.#engine.currentTime = time;
  }

  get mode() {
    return this.#strategy;
  }

  set mode(mode: PlayModeStrategy<T>) {
    this.#strategy.destroy?.();
    this.#strategy = mode;
    this.#strategy.init?.({ index: this.index, queue: this.#queue.tracks });
  }

  get currentTrack() {
    return this.#queue.tracks[this.index];
  }

  get queue() {
    return this.#queue.tracks;
  }

  replace(tracks: T[]) {
    this.#queue.replace(tracks);
    if (tracks.length === 0) {
      this.index = -1;
    } else {
      this.index = Math.min(Math.max(this.index, 0), tracks.length - 1);
    }
    this.#strategy.init?.({ index: this.index, queue: this.#queue.tracks });
  }

  add(track: T) {
    this.#queue.add(track);
    if (this.index === -1 && this.#queue.length > 0) {
      this.index = 0;
    }
    this.#strategy.init?.({ index: this.index, queue: this.#queue.tracks });
  }

  insert(track: T, index: number) {
    if (index <= this.index) {
      this.index++;
    }
    this.#queue.insert(index, track);
    this.#strategy.init?.({ index: this.index, queue: this.#queue.tracks });
  }

  remove(id: string | number) {
    const removedIdx = this.#queue.indexOf(id);
    if (removedIdx < 0) return;

    if (removedIdx < this.index) {
      this.index--;
    } else if (removedIdx === this.index) {
      this.index = Math.min(this.index, this.#queue.length - 2);
    }

    this.#queue.remove(id);
    this.#strategy.init?.({ index: this.index, queue: this.#queue.tracks });
  }

  setQueue(tracks: T[], startIndex = 0) {
    this.#queue.replace(tracks);
    if (tracks.length > 0 && startIndex >= 0 && startIndex < tracks.length) {
      this.index = startIndex;
    } else if (tracks.length > 0) {
      this.index = 0;
    } else {
      this.index = -1;
    }
    this.#strategy.init?.({ index: this.index, queue: this.#queue.tracks });
  }

  on<K extends keyof AudioEvents>(event: K, handler: AudioEvents[K]) {
    return this.#engine.on(event, handler);
  }

  get muted() {
    return this.#engine.muted;
  }
  set muted(value: boolean) {
    this.#engine.muted = value;
  }

  get volume() {
    return this.#engine.volume;
  }
  set volume(value: number) {
    if (value < 0 || value > 1) {
      throw new RangeError("音量必须在 0 和 1 之间");
    }
    this.#engine.volume = value;
  }

  get playing() {
    return this.#engine.playing;
  }

  get duration() {
    return this.#engine.duration;
  }
}
