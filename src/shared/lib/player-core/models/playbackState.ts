// 播放状态快照（transport + 当前曲，供 UI / 适配层订阅）。
// 库本身不驱动 60fps 状态；此类型只是「此刻播放器是什么样」的聚合描述。

import type { Track } from './track';

export type PlaybackState = {
  currentTrack: Track | null;
  playing: boolean;
  position: number;
  duration: number;
  volume: number;
  muted: boolean;
  isExhausted: boolean;
};
