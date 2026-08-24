import type { BaseEventMap, IAudioCore } from "./types";

export interface AudioCoreEventMap extends BaseEventMap {}

export class AudioCore implements IAudioCore<AudioCoreEventMap> {
  readonly #element: HTMLAudioElement;
  readonly ended: boolean = false;

  constructor(element?: HTMLAudioElement) {
    this.#element = element ?? new Audio();
  }

  get currentTime() {
    return this.#element.currentTime;
  }

  get duration() {
    return this.#element.duration;
  }

  get playing() {
    return !this.#element.paused;
  }

  get src() {
    return this.#element.src;
  }

  get volume() {
    return this.#element.volume;
  }

  set volume(value) {
    this.#element.volume = Math.min(1, Math.max(0, value));
  }

  get muted() {
    return this.#element.muted;
  }

  set muted(value) {
    this.#element.muted = value;
  }

  get rate() {
    return this.#element.playbackRate;
  }

  set rate(value) {
    this.#element.playbackRate = Math.max(0, value);
  }

  async play() {
    await this.#element.play();
  }

  pause() {
    this.#element.pause();
  }

  seek(time: number) {
    this.#element.currentTime = time;
  }

  load(src: string) {
    this.#element.src = src;
    this.#element.load();
  }

  on<K extends keyof AudioCoreEventMap>(
    event: K,
    callback: AudioCoreEventMap[K],
  ): () => void {
    switch (event) {
      default:
        return () => {
          return;
        };
    }
  }
}
