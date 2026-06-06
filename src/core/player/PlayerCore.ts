import { EventEmitter } from "@/lib/EventEmitter";
import { AudioEngine } from "./AudioEngine";
import type { PlayerEvents } from "./EventBus";
import { PlayQueue } from "./PlayQueue";
import { StateMachine } from "./StateMachine";
import type { PlayModeStrategy } from "./strategy/Strategy";
import type { PlayerState } from "./types";

export class PlayerCore<T extends { id: number }> {
  #queue: PlayQueue<T>;
  #engine: AudioEngine;
  #strategy: PlayModeStrategy<T>;
  #stateMachine: StateMachine;
  #eventBus: EventEmitter<PlayerEvents<T>>;

  constructor(mode: PlayModeStrategy<T>) {
    this.#queue = new PlayQueue();
    this.#engine = new AudioEngine();
    this.#stateMachine = new StateMachine();
    this.#strategy = mode;
    this.#eventBus = new EventEmitter();

    this.#bindEvents();
  }

  get index() {
    return this.#queue.activeIndex;
  }

  set index(v: number) {
    if (this.#queue.activeIndex === v) return;
    this.#queue.activeIndex = v;
    this.#emitTrackChange();
  }

  get state(): PlayerState {
    return this.#stateMachine.state;
  }

  get stateMachine() {
    return this.#stateMachine;
  }

  #transition(to: PlayerState): boolean {
    return this.#stateMachine.transition(to);
  }

  #emitTrackChange() {
    this.#eventBus.emit("trackChange", this.#queue.current);
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

  #bindEvents() {
    this.#engine.on("ended", () => {
      if (!this.#transition("ended")) return;
      this.#queue.activeIndex = this.#strategy.ended(this.#queue.context);
      this.#emitTrackChange();
    });

    this.#engine.on("timeupdate", (currentTime, _duration) => {
      this.#eventBus.emit("timeUpdate", currentTime);
    });

    this.#engine.on("loadedmetadata", (duration) => {
      this.#eventBus.emit("durationChange", duration);
    });

    this.#stateMachine.onTransition = (state) => {
      this.#eventBus.emit("stateChange", state);
    };
  }

  async load(url: string) {
    this.#transition("loading");
    this.#engine.load(url);

    await new Promise<void>((resolve) => {
      const off = this.#engine.on("canPlay", () => {
        off();
        resolve();
      });
    });
    this.#transition("ready");
  }

  async play() {
    const track = this.currentTrack;
    if (!track) return;
    if (this.state === "playing") return;

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

  stop() {
    this.#engine.pause();
    this.#transition("idle");
  }

  next() {
    if (this.#queue.isEmpty) return;
    this.#engine.stopTimeUpdate();
    this.#queue.activeIndex = this.#strategy.next(this.#queue.context);
    this.#emitTrackChange();
  }

  prev() {
    if (this.#queue.isEmpty) return;
    this.#engine.stopTimeUpdate();
    this.#queue.activeIndex = this.#strategy.prev(this.#queue.context);
    this.#emitTrackChange();
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
    const prev = this.#queue.current;
    this.#queue.replace(tracks);
    this.#strategy.init?.(this.#queue.context);
    if (prev !== this.#queue.current) {
      this.#emitTrackChange();
    }
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
    const prev = this.#queue.current;
    if (!this.#queue.remove(id)) return;
    this.#strategy.init?.(this.#queue.context);
    if (prev !== this.#queue.current) {
      this.#emitTrackChange();
    }
  }

  setQueue(tracks: T[], startIndex = 0) {
    this.#queue.set(tracks, startIndex);
    this.#strategy.init?.(this.#queue.context);
    this.#emitTrackChange();
  }

  on<K extends keyof PlayerEvents<T>>(event: K, handler: PlayerEvents<T>[K]) {
    return this.#eventBus.on(event, handler);
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
