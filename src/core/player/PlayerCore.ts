import type { AudioEvents } from "./AudioEngine";
import { AudioEngine } from "./AudioEngine";
import { PlayQueue } from "./PlayQueue";
import { StateMachine } from "./StateMachine";
import type { PlayModeStrategy } from "./strategy/Strategy";
import type { PlayerState } from "./types";

export class PlayerCore<T extends { id: number; url: string }> {
  #queue: PlayQueue<T>;
  #engine: AudioEngine;
  #strategy: PlayModeStrategy<T>;
  #stateMachine: StateMachine;
  constructor(mode: PlayModeStrategy<T>) {
    this.#queue = new PlayQueue();
    this.#engine = new AudioEngine();
    this.#stateMachine = new StateMachine();
    this.#strategy = mode;

    this.#bindEvents();
  }

  get index() {
    return this.#queue.activeIndex;
  }

  set index(v: number) {
    this.#queue.activeIndex = v;
  }

  get state(): PlayerState {
    return this.#stateMachine.state;
  }

  #transition(to: PlayerState): boolean {
    return this.#stateMachine.transition(to);
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
    this.#queue.activeIndex = this.#strategy.next(this.#queue.context);
    this.load();
    this.play();
  }

  prev() {
    this.#queue.activeIndex = this.#strategy.prev(this.#queue.context);
    this.load();
    this.play();
  }

  ended() {
    this.#queue.activeIndex = this.#strategy.ended(this.#queue.context);
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
    this.#strategy.init?.(this.#queue.context);
  }

  get currentTrack() {
    return this.#queue.current;
  }

  get queue() {
    return this.#queue.tracks;
  }

  replace(tracks: T[]) {
    this.#queue.replace(tracks);
    this.#strategy.init?.(this.#queue.context);
  }

  add(track: T) {
    this.#queue.add(track);
    this.#strategy.init?.(this.#queue.context);
  }

  insert(track: T, index: number) {
    this.#queue.insert(index, track);
    this.#strategy.init?.(this.#queue.context);
  }

  remove(id: string | number) {
    if (!this.#queue.remove(id)) return;
    this.#strategy.init?.(this.#queue.context);
  }

  setQueue(tracks: T[], startIndex = 0) {
    this.#queue.set(tracks, startIndex);
    this.#strategy.init?.(this.#queue.context);
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
