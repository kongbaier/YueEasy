// AudioCore —— 前端音频引擎基元（infra，全栈可用）。
//
// 封装单个 `new Audio()`（非 JSX <audio>），带播放状态机 + 事件。
// 这是播放器「前端唯一权威」的物理层：progress/seek/ended 的实时真源。
// 逐字歌词直接 rAF 读 `getPosition()`（同进程同帧，零 IPC）。
//
// 事件面 = HTML5 MediaElement 原生语义（不造自定义词）：
//   loadstart → 开始加载资源（loading=true）
//   play      → play() 被调用、开始尝试（乐观反馈，可能未出声）
//   waiting   → 缓冲等待（loading=true）
//   playing   → 真正出声（loading=false，playing=true）
//   pause     → 暂停
//   ended     → 自然播完
//   error     → 错误

import { EventEmitter } from '../EventEmitter';

export type AudioStatus =
  | 'idle'
  | 'loading'
  | 'playing'
  | 'paused'
  | 'ended'
  | 'error';

export type AudioCoreEvents = {
  /** 播放位置推进（浏览器 ~4Hz 节流；低频进度条用。高频逐字请 rAF 直读 getPosition()）。 */
  timeupdate: [number];
  /** 开始加载资源。 */
  loadstart: [void];
  /** play() 被调用、开始尝试播放。 */
  play: [void];
  /** 真正开始出声。 */
  playing: [void];
  /** 缓冲不足、等待数据。 */
  waiting: [void];
  /** 暂停。 */
  pause: [void];
  /** 自然播完。 */
  ended: [void];
  /** 加载/播放错误。 */
  error: [string];
};

export class AudioCore {
  private readonly audio: HTMLAudioElement;
  private readonly emitter = new EventEmitter<AudioCoreEvents>();
  private status: AudioStatus = 'idle';

  constructor() {
    this.audio = new Audio();
    this.audio.preload = 'auto';
    this.bindEvents();
  }

  private bindEvents(): void {
    const a = this.audio;
    a.addEventListener('loadstart', () => {
      this.status = 'loading';
      this.emitter.emit('loadstart');
    });
    a.addEventListener('timeupdate', () => {
      this.emitter.emit('timeupdate', a.currentTime);
    });
    a.addEventListener('play', () => {
      this.emitter.emit('play');
    });
    a.addEventListener('playing', () => {
      this.status = 'playing';
      this.emitter.emit('playing');
    });
    a.addEventListener('waiting', () => {
      this.status = 'loading';
      this.emitter.emit('waiting');
    });
    a.addEventListener('pause', () => {
      if (this.status !== 'error') this.status = 'paused';
      this.emitter.emit('pause');
    });
    a.addEventListener('ended', () => {
      this.status = 'ended';
      this.emitter.emit('ended');
    });
    a.addEventListener('error', () => {
      this.status = 'error';
      this.emitter.emit('error', '音频加载失败（网络错误或编码不受支持）');
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
    this.status = 'loading';
    this.audio.src = url;
    this.emitter.emit('loadstart');
  }

  /** 显式设置 src（自定义协议 / 探针路径）。 */
  setSrc(url: string): void {
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

  seek(secs: number): void {
    if (!Number.isFinite(secs) || secs < 0) return;
    this.audio.currentTime = secs;
    this.emitter.emit('timeupdate', secs);
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

  getStatus(): AudioStatus {
    return this.status;
  }

  isEnded(): boolean {
    return this.audio.ended;
  }
}

/** 全局单例：播放器 store / orchestrator 与组件共用同一 audio 真源。 */
export const audioCore = new AudioCore();
