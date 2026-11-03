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
  /**
   * 是否把播放记录上报到网易云「最近播放」。
   * 关闭后播放不再记录，`最近播放` 页只显示此前的云端记录。
   */
  savePlaybackHistory: boolean;
  /** 音频文件磁盘缓存上限（MB）；`0` = 关闭缓存（不读不写）。 */
  audioCacheLimitMB: number;
}
