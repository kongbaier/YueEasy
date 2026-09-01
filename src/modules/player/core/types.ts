import type { Track } from "@/shared/lib/player-core/models/track";

/**
 * 播放源策略
 */
export interface IPlaybackPolicy {
  // 当前曲目
  getCurrent(): Track | null;

  // 导航
  next(): Track | null;
  previous(): Track | null;

  // 数据操作
  append(tracks: Track[]): void;
  remove(id: string): void;
  clear(): void;

  // 自动播放下一首（自然结束时的处理）
  handleAutoNext(): Track | null;

  // 状态 Getter
  readonly isExhausted: boolean;
  readonly tracks: readonly Track[];

  initialize(): void;
  dispose(): void;
}

/** 遍历顺序：决定「队列内如何遍历」。 */
export type Order = "sequential" | "shuffle";

/** 终止策略：决定「队尾 / 曲终如何终止」。FM 仅用 off / one。 */
export type Repeat = "off" | "all" | "one";
