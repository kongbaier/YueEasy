import type { WindowsEffect } from './effect';

export type Theme = 'light' | 'dark' | 'system';
export type CloseBehavior = 'quit' | 'hide';

/**
 * 播放音质档位（= NCM 客户端 `level` 取值，从低到高）。
 *
 * 服务端按账号权限**静默降级**：非 VIP 请求 `lossless` / `hires` / `jymaster` /
 * `sky` 会回 `exhigh`（320k mp3）。所以这里只是「请求档位」，真实档位由
 * `resolve_play_url` 返回的 `level` 给出（播放栏展示的就是它）。
 */
export type AudioQuality =
  | 'standard'
  | 'higher'
  | 'exhigh'
  | 'lossless'
  | 'hires'
  | 'jymaster'
  | 'sky';

/** 应用外观设置（appearance namespace）。 */
export interface AppearanceSettings {
  theme: Theme;
  windowEffect: WindowsEffect;
  closeBehavior: CloseBehavior;
}

/** 桌面歌词偏好（`player.desktopLyrics`）。只管「显示成什么样」，窗口能力由 Rust 侧实现。 */
export interface DesktopLyricsSettings {
  /** 窗口是否开启（启动时按此恢复；Rust 侧窗口开关由前端驱动）。 */
  enabled: boolean;
  /** 是否锁定：窗口鼠标穿透、不可拖动，需悬停一段更长时间才浮现「解锁」入口。 */
  locked: boolean;
  /** 当前句字号（px）；上下一句按比例缩放。 */
  fontSize: number;
  /** 上下一句的不透明度（`0` = 不显示）。 */
  sideLineOpacity: number;
  /** 是否显示翻译行。 */
  showTranslation: boolean;
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
  /**
   * 播放音质（请求档位，`level` 参数）。实际到手档位可能被账号权限降级，
   * 真实值由 `resolve_play_url` 返回并在播放栏展示。
   */
  audioQuality: AudioQuality;
  /** 桌面歌词（窗口开关 / 锁定 / 排版偏好）。 */
  desktopLyrics: DesktopLyricsSettings;
}
