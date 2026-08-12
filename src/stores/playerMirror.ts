// Phase E：Player MirrorStore —— 纯镜像 Rust PlayerEngine 状态（设计 §5.2）。
// 只读、不定义任何 action：事件同步全部由 `usePlayerEvents` hook 处理
// （监听 `player:event` → setState），其他组件只读订阅。

import { create } from 'zustand';
import type { QueueItem } from '@/shared/types/entities';
import type { RustPlayMode } from '@/shared/types/player';

export interface PlayerMirrorState {
  /** 当前曲目（Rust wire 类型 QueueItem）。 */
  currentTrack: QueueItem | null;
  /** 播放/暂停权威状态（Rust `PlayerState.playing`，前端乐观更新）。 */
  playing: boolean;
  /** 完整队列（全量推送，前端不做合并）。 */
  queue: QueueItem[];
  /** 当前队列索引。 */
  currentIndex: number | null;
  /** 播放模式（Rust PlayMode snake_case wire）。 */
  mode: RustPlayMode;
  /** FM 是否激活。 */
  fmActive: boolean;
}

/** 初始值全部为空；仅在 `player:event` 推送时由 `usePlayerEvents` 写入。 */
export const usePlayerMirrorStore = create<PlayerMirrorState>(() => ({
  currentTrack: null,
  playing: false,
  queue: [],
  currentIndex: null,
  mode: 'sequential',
  fmActive: false,
}));
