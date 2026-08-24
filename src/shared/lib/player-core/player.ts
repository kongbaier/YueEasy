import type { IAudioCore, IPlaybackPolicy } from "./types";
import type { Track } from "./models/track";

// Player —— 播放编排（组合 audio + policy，零业务逻辑）。
//
// 只做「audio ↔ policy」的桥接：导航结果 → load+play；自然结束 → handleAutoNext。
// 换源经 setPolicy（dispose 旧 + initialize 新）。FM 续歌等业务由外部适配层在
// policy 耗尽（isExhausted）时处理——库不 fetch、不 resolve URL、不持有业务状态。

export class Player {
  #audio: IAudioCore;
  #policy: IPlaybackPolicy;

  constructor(audio: IAudioCore, policy: IPlaybackPolicy) {
    this.#audio = audio;
    this.#policy = policy;
    this.#policy.initialize();
    // 自然结束 → 策略自动推进；耗尽（null）时停在此处，交由外部续歌。
    this.#audio.on("ended", () => {
      this.handleAutoNext();
    });
  }

  setPolicy(policy: IPlaybackPolicy) {
    this.#policy.dispose();
    this.#policy = policy;
    this.#policy.initialize();
  }

  get policy(): IPlaybackPolicy {
    return this.#policy;
  }

  get currentTrack(): Track | null {
    return this.#policy.getCurrent();
  }

  get isExhausted(): boolean {
    return this.#policy.isExhausted;
  }

  play() {
    void this.#audio.play();
  }

  pause() {
    this.#audio.pause();
  }

  next(): Track | null {
    const t = this.#policy.next();
    if (t) this.#loadAndPlay(t);
    return t;
  }

  prev(): Track | null {
    const t = this.#policy.previous();
    if (t) this.#loadAndPlay(t);
    return t;
  }

  seek(time: number) {
    this.#audio.seek(time);
  }

  handleAutoNext(): Track | null {
    const t = this.#policy.handleAutoNext();
    if (t) this.#loadAndPlay(t);
    return t;
  }

  #loadAndPlay(track: Track) {
    this.#audio.load(track.src);
    void this.#audio.play();
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
