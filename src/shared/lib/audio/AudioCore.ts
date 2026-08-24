// AudioCore —— 前端音频引擎基元（infra，全栈可用）。
//
// 封装单个 `new Audio()`（非 JSX <audio>）。这是播放器「前端唯一权威」的物理层：
// progress/seek/ended 的实时真源。逐字歌词直接 rAF 读 `getPosition()`（同进程同帧，零 IPC）。
//
// Actor 模式：状态权威在 XState 状态机（audioMachine），本类作为边界——
//   · 构造时 `createActor(machine, { input: { audio } })` 注入 audio（guard 读它）；
//   · DOM 原生事件 → `actor.send(...)`，状态机投影为单一 AudioStatus；
//   · 状态快照经 `status` 事件广播，消费方（PlayerStore）据此派生 playing/loading/buffering。
//
// 事件面 = 机器投影后的消费信号（不是 DOM 事件直译，drop 了 play/playing/waiting/pause
// 等会被 status 覆盖的细分信号）：
//   status     → 状态机快照（loading/playing/buffering…）
//   timeupdate → 播放位置（浏览器 ~4Hz 节流；高频逐字请 rAF 直读 getPosition()）
//   ended      → 自然播完（触发队列推进的离散信号）
//   error      → 加载/播放错误

import { createActor } from "xstate";
import { EventEmitter } from "../EventEmitter";
import { audioMachine, type AudioStatus } from "./audioMachine";

export type AudioCoreEvents = {
  /** 播放位置推进（浏览器 ~4Hz 节流；低频进度条用。高频逐字请 rAF 直读 getPosition()）。 */
  timeupdate: [number];
  /** 状态机快照变化（idle/loading/ready/playing/paused/buffering/ended/error）。 */
  status: [AudioStatus];
  /** 自然播完。 */
  ended: [void];
  /** 加载/播放错误。 */
  error: [string];
};

export class AudioCore {
  private readonly audio: HTMLAudioElement;
  private readonly emitter = new EventEmitter<AudioCoreEvents>();
  private readonly actor;

  constructor() {
    this.audio = new Audio();
    this.audio.preload = "auto";
    // 注入 audio 到机器 context；guard（notSeeking）直读 audio.seeking
    this.actor = createActor(audioMachine, { input: { audio: this.audio } });
    this.actor.subscribe((snapshot) => {
      this.emitter.emit("status", snapshot.value);
    });
    this.actor.start();
    this.bindEvents();
  }

  private bindEvents(): void {
    const a = this.audio;
    a.addEventListener("loadstart", () => {
      this.actor.send({ type: "LOAD_START" });
    });
    a.addEventListener("loadedmetadata", () => {
      this.actor.send({ type: "LOADED_METADATA" });
    });
    a.addEventListener("playing", () => {
      this.actor.send({ type: "PLAYING" });
    });
    a.addEventListener("waiting", () => {
      // 机器内 notSeeking guard 排掉 seek 引起的 waiting
      this.actor.send({ type: "WAITING" });
    });
    a.addEventListener("canplay", () => {
      this.actor.send({ type: "CAN_PLAY" });
    });
    a.addEventListener("pause", () => {
      this.actor.send({ type: "PAUSE" });
    });
    a.addEventListener("ended", () => {
      this.actor.send({ type: "ENDED" });
      this.emitter.emit("ended");
    });
    a.addEventListener("error", () => {
      this.actor.send({ type: "ERROR" });
      this.emitter.emit("error", "音频加载失败（网络错误或编码不受支持）");
    });
    a.addEventListener("timeupdate", () => {
      this.emitter.emit("timeupdate", a.currentTime);
    });
  }

  // ── 事件 ──

  on<K extends keyof AudioCoreEvents>(
    event: K,
    listener: (...args: AudioCoreEvents[K]) => void,
  ): () => void {
    return this.emitter.on(event, listener);
  }

  // ── 播放控制 ──

  /** 加载一个 URL 并进入 loading。之后调 play() 开始播放。 */
  load(url: string): void {
    this.actor.send({ type: "LOAD_START" }); // 乐观先行，DOM loadstart 异步再证（loading 中忽略）
    this.audio.src = url;
  }

  async play(): Promise<void> {
    try {
      await this.audio.play();
    } catch {
      // 自动播放拦截 / 无 source 等：状态交由元素事件（error/pause）
    }
  }

  pause(): void {
    this.audio.pause();
  }

  /** 清空到 idle（清队列 / 启动恢复）：停播 + 摘 src + 机器回 idle。 */
  reset(): void {
    this.audio.pause();
    this.audio.removeAttribute("src");
    this.actor.send({ type: "RESET" });
  }

  seek(secs: number): void {
    if (!Number.isFinite(secs) || secs < 0) return;
    this.audio.currentTime = secs;
    this.emitter.emit("timeupdate", secs);
  }

  setVolume(vol: number): void {
    this.audio.volume = Math.min(1, Math.max(0, vol));
  }

  setMuted(muted: boolean): void {
    this.audio.muted = muted;
  }

  // ── 只读 ──

  /** 当前播放位置（秒）—— 逐字歌词/进度条 rAF 直读的真源。 */
  getPosition(): number {
    return this.audio.currentTime;
  }

  /** 已加载时长（元数据/流式可用时）；未知返回 0。 */
  getDuration(): number {
    const d = this.audio.duration;
    return Number.isFinite(d) ? d : 0;
  }

  /** 状态机快照（idle/loading/ready/playing/paused/buffering/ended/error）。 */
  getStatus(): AudioStatus {
    return this.actor.getSnapshot().value as AudioStatus;
  }

  isEnded(): boolean {
    return this.audio.ended;
  }
}

/** 全局单例：播放器 store / orchestrator 与组件共用同一 audio 真源。 */
export const audioCore = new AudioCore();
