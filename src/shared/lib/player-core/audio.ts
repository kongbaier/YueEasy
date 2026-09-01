import type { AudioStatus, BaseEventMap, IAudioCore } from "./types";

export interface AudioCoreEventMap extends BaseEventMap {}

// AudioCore —— IAudioCore 的 HTMLAudioElement 实现（平台基元，唯一触碰 DOM 的地方）。
//
// 轻量状态投影（不引 xstate）：由 DOM 原生事件 → 简单状态迁移，输出单一 AudioStatus；
// 状态变化经 `status` 事件广播，消费方据此派生 playing/loading/buffering。
// 只投影不会自相矛盾的子集：
//   · load() 乐观 loading；loadedmetadata → paused（元数据就绪）
//   · waiting（非 seek）→ buffering；playing/canplay → playing
//   · pause → paused、ended → ended、error → error
// 状态是浏览器真值（readyState/paused）的投影像，不在此再建一份正交真值。

/** DOM 原生事件名 → 回调（内部桥接表，被 #emit 转发到订阅者）。 */
type NativeHandler = (el: HTMLAudioElement) => void;

export class AudioCore implements IAudioCore<AudioCoreEventMap> {
  readonly #element: HTMLAudioElement;
  #status: AudioStatus = "idle";
  #listeners = new Map<
    keyof AudioCoreEventMap,
    Set<(...a: unknown[]) => void>
  >();

  constructor(element?: HTMLAudioElement) {
    this.#element = element ?? new Audio();
    this.#element.preload = "auto";
    this.#bind();
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
    try {
      await this.#element.play();
    } catch {
      // 自动播放拦截 / 无 source：状态交由元素事件（error/pause）
    }
  }

  pause() {
    this.#element.pause();
  }

  seek(time: number) {
    if (!Number.isFinite(time) || time < 0) return;
    this.#element.currentTime = time;
    this.#emit("timeupdate", time);
  }

  load(src: string) {
    // 乐观先行 loading；DOM loadedmetadata 异步再校正为 paused
    this.#setStatus("loading");
    this.#element.src = src;
    this.#element.load();
  }

  reset() {
    this.#element.pause();
    this.#element.removeAttribute("src");
    this.#setStatus("idle");
  }

  getStatus(): AudioStatus {
    return this.#status;
  }

  /** 当前播放位置（秒）——逐字歌词 / 进度条 rAF 直读的真源。 */
  getPosition(): number {
    return this.#element.currentTime;
  }

  on<K extends keyof AudioCoreEventMap>(
    event: K,
    callback: AudioCoreEventMap[K],
  ): () => void {
    const set = this.#listeners.get(event) ?? new Set();
    set.add(callback as (...a: unknown[]) => void);
    this.#listeners.set(event, set);
    return () => {
      set.delete(callback as (...a: unknown[]) => void);
    };
  }

  // ── 内部：DOM → 状态投影 / 事件分发 ──

  #bind() {
    const a = this.#element;
    const wire = (type: string, handler: NativeHandler) => {
      const fn = () => handler(a);
      a.addEventListener(type, fn);
    };

    wire("timeupdate", (el) => this.#emit("timeupdate", el.currentTime));
    wire("pause", () => {
      this.#setStatus("paused");
      this.#emit("pause");
    });
    wire("playing", () => this.#setStatus("playing"));
    wire("ended", () => {
      this.#setStatus("ended");
      this.#emit("ended");
    });
    wire("error", (el) => {
      this.#setStatus("error");
      this.#emit("error", el.error ?? ({} as MediaError));
    });
    // play 是异步：结算后广播；waiting/canplay 处理缓冲
    wire("play", () => {
      void (async () => {
        this.#setStatus("playing");
        this.#emit("play");
      })();
    });
    wire("waiting", () => {
      if (!a.seeking) this.#setStatus("buffering");
    });
    wire("canplay", () => {
      if (this.#status === "buffering") this.#setStatus("playing");
    });
    wire("loadedmetadata", () => {
      if (this.#status === "loading") this.#setStatus("paused");
    });
  }

  #setStatus(status: AudioStatus) {
    if (status === this.#status) return;
    this.#status = status;
    this.#emit("status", status);
  }

  #emit<K extends keyof AudioCoreEventMap>(
    event: K,
    ...args: Parameters<AudioCoreEventMap[K]>
  ) {
    for (const fn of this.#listeners.get(event) ?? []) {
      (fn as (...a: unknown[]) => void)(...args);
    }
  }
}
