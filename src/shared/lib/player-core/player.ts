import type { IAudioCore, IPlaybackPolicy } from "./types";
import type { Track } from "./models/track";

export type ResolveUrl = (track: Track) => Promise<string | null>;

// Player —— 播放编排（组合 audio + policy + URL 解析钩子，零业务逻辑）。
//
// 只做「audio ↔ policy ↔ resolver」的桥接：
//   · 导航（next/prev/handleAutoNext）→ 策略给出下一曲 → onResolve 异步解析 URL → load+play。
//   · 自然结束（ended）自动 handleAutoNext；耗尽（无下一曲）停在此处，交由外部续歌。
// 换源经 setPolicy（dispose 旧 + initialize 新）。
// URL 解析是异步业务（缓存 / 反竞态 / FM 续歌）——由 app 注入 ResolveUrl 闭包，库不实现；
// resolver 返回 null 表示无 URL（坏歌 / 竞态被取代），跳过本轮播放。

export class Player {
  #audio: IAudioCore;
  #policy: IPlaybackPolicy;
  #resolve: ResolveUrl;

  constructor(
    audio: IAudioCore,
    policy: IPlaybackPolicy,
    resolve: ResolveUrl = () => Promise.resolve(null),
  ) {
    this.#audio = audio;
    this.#policy = policy;
    this.#resolve = resolve;
    this.#policy.initialize();
    // 注意：库 Player 不自动接管 ended——自然结束（ended → handleAutoNext）与 FM 续歌
    // 由编排层（store）决定（需接入 URL 反竞态 / 续歌逻辑）。库只提供 handleAutoNext() 原语。
  }

  /** 注入 / 替换 URL 解析（app 端带缓存、反竞态与 FM 续歌语义）。 */
  setResolver(resolve: ResolveUrl) {
    this.#resolve = resolve;
  }

  /** 换源：安装新 policy 并返回被置换的旧 policy（不自动 dispose——由调用方决定是否清除）。
   *  这样多来源（队列流 / 推荐流）可各自持有 policy 对象，切换时仅换引用，不丢各自队列。 */
  setPolicy(policy: IPlaybackPolicy): IPlaybackPolicy {
    const old = this.#policy;
    this.#policy = policy;
    this.#policy.initialize();
    return old;
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

  async next(): Promise<Track | null> {
    const t = this.#policy.next();
    if (t) await this.#loadAndPlay(t);
    return t;
  }

  async prev(): Promise<Track | null> {
    const t = this.#policy.previous();
    if (t) await this.#loadAndPlay(t);
    return t;
  }

  seek(time: number) {
    this.#audio.seek(time);
  }

  /** 自然结束推进；返回 null 表示策略已耗尽（外部续歌）。 */
  async handleAutoNext(): Promise<Track | null> {
    const t = this.#policy.handleAutoNext();
    if (t) await this.#loadAndPlay(t);
    return t;
  }

  /** app 端「播放指定曲目 / 整单替换」入口（占位，供 store 直接触发加载）。 */
  async loadAndPlay(track: Track): Promise<void> {
    await this.#loadAndPlay(track);
  }

  async #loadAndPlay(track: Track) {
    const url = await this.#resolve(track);
    if (url == null) return; // 坏歌 / 竞态被取代
    this.#audio.load(url);
    await this.#audio.play();
  }

  get currentTime() {
    return this.#audio.currentTime;
  }

  get duration() {
    return this.#audio.duration;
  }

  get status() {
    return this.#audio.getStatus();
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
