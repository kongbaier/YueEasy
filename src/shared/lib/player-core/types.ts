export type BaseEventMap = {
  timeupdate: (currentTime: number) => void;
  play: () => Promise<void>;
  pause: () => void;
  ended: () => void;
  error: (error: MediaError) => void;
  waiting: () => void;
  /** 状态投影（idle/loading/playing/paused/buffering/ended/error）触发变化时广播。 */
  status: (status: AudioStatus) => void;
};

/** 音频状态投影（供 orchestration / UI 作 playing/loading/buffering 真源）。 */
export type AudioStatus =
  | 'idle'
  | 'loading'
  | 'playing'
  | 'paused'
  | 'buffering'
  | 'ended'
  | 'error';

/**
 * 音频播放设施
 */
export interface IAudioCore<T extends BaseEventMap = BaseEventMap> {
  // 播放控制
  load(url: string): void;
  play(): Promise<void>;
  pause(): void;
  seek(time: number): void;
  /** 清空到 idle：停播 + 摘 src（清队列 / 启动恢复）。 */
  reset(): void;

  // 状态查询（Getter）
  currentTime: number;
  volume: number;
  src: string;
  muted: boolean;
  rate: number;
  readonly duration: number;
  readonly playing: boolean;
  readonly ended: boolean;

  /** status 投影（如 load 后即刻进 loading 供乐观反馈）。 */
  getStatus(): AudioStatus;

  // 事件订阅（泛型映射 + 返回取消函数）
  on<K extends keyof T>(event: K, callback: T[K]): () => void;
}
