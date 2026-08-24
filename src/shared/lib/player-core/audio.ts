import type { BaseEventMap, IAudioCore } from "./types";

export interface AudioCoreEventMap extends BaseEventMap {}

// AudioCore —— IAudioCore 的 HTMLAudioElement 实现（平台基元，唯一触碰 DOM 的地方）。
// 原生 DOM 事件直译到 BaseEventMap；on() 返回取消函数。

export class AudioCore implements IAudioCore<AudioCoreEventMap> {
  readonly #element: HTMLAudioElement;

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

  get ended() {
    return this.#element.ended;
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
    const el = this.#element;
    let handler: EventListener;
    switch (event) {
      case "timeupdate":
        handler = () =>
          (callback as AudioCoreEventMap["timeupdate"])(el.currentTime);
        break;
      case "play":
        handler = () => void (callback as AudioCoreEventMap["play"])();
        break;
      case "pause":
        handler = () => (callback as AudioCoreEventMap["pause"])();
        break;
      case "ended":
        handler = () => (callback as AudioCoreEventMap["ended"])();
        break;
      case "error":
        handler = () =>
          (callback as AudioCoreEventMap["error"])(
            el.error ?? ({} as MediaError),
          );
        break;
      case "waiting":
        handler = () => (callback as AudioCoreEventMap["waiting"])();
        break;
      default:
        return () => {};
    }
    el.addEventListener(event, handler);
    return () => el.removeEventListener(event, handler);
  }
}
