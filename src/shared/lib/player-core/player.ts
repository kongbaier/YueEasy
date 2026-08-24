import type { IAudioCore, IPlaybackPolicy } from "./types";

export class Player {
  #audio: IAudioCore;
  #policy: IPlaybackPolicy;

  constructor(audio: IAudioCore, policy: IPlaybackPolicy) {
    this.#audio = audio;
    this.#policy = policy;
  }

  setPolicy(policy: IPlaybackPolicy) {
    this.#policy.dispose();
    this.#policy = policy;
    this.#policy.initialize();
  }

  play() {
    this.#audio.play();
  }

  pause() {
    this.#audio.pause();
  }

  next() {
    this.#policy.next();
  }

  prev() {
    this.#policy.previous();
  }

  seek(time: number) {
    this.#audio.seek(time);
  }

  handleAutoNext() {
    this.#policy.handleAutoNext();
  }

  get currentTime() {
    return this.#audio.currentTime;
  }

  get duration() {
    return this.#audio.duration;
  }

  get volume() {
    return this.#audio.volume;
  }

  set volume(value: number) {
    this.#audio.volume = Math.max(0, Math.min(1, value));
  }

  get muted() {
    return this.#audio.muted;
  }

  set muted(value) {
    this.#audio.muted = value;
  }

  get rate() {
    return this.#audio.rate;
  }

  set rate(value) {
    this.#audio.rate = Math.max(0, value);
  }
}
