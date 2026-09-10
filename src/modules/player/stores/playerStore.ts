import { create } from 'zustand';
import type { QueueItem } from '@/shared/types/entities';

// playerStore —— 播放 transport 状态（纯状态容器，无编排）。
//
// 编排（URL 解析 / FM 续歌 / ended / next 决策）在 PlayerService；
// 本 store 只承载 60fps 投影状态，由 PlayerService 订阅 audioCore 事件后 setState 写入。
// 组件经 usePlayer 门面读取；命令经 playerService 发起，store 不暴露任何 action。

export interface PlayerState {
  currentTrack: QueueItem | null;
  playing: boolean;
  loading: boolean;
  buffering: boolean;
  currentTime: number;
  duration: number;
}

export const usePlayerStore = create<PlayerState>()(() => ({
  currentTrack: null,
  playing: false,
  loading: false,
  buffering: false,
  currentTime: 0,
  duration: 0,
}));
