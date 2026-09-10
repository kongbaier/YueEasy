import type { WindowsEffect } from './effect';

export type Theme = 'light' | 'dark' | 'system';
export type CloseBehavior = 'quit' | 'hide';

/** 应用外观设置（appearance namespace）。 */
export interface AppearanceSettings {
  theme: Theme;
  windowEffect: WindowsEffect;
  closeBehavior: CloseBehavior;
}

/** 播放器偏好设置（player namespace）。 */
export interface PlayerSettings {
  volume: number;
  isMuted: boolean;
  playbackRate: number;
  /** 是否在本地记录播放历史（SQLite play_history），用于最近播放综合展示。 */
  savePlaybackHistory: boolean;
}
