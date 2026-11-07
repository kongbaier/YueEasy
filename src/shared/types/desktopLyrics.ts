// 桌面歌词的跨窗口 wire 形状（主窗口 ↔ 桌面歌词窗口，经 Tauri 事件通道）。
//
// 三个方向，各有唯一权威：
//   main  → window : snapshot / playback / state     （歌词、进度锚点、锁定+排版设置）
//   Rust  → window : reveal                          （锁定态的悬停揭示，见 platform::desktop_lyrics）
//   window → main  : request                         （开关 / 锁定 / 播放命令 / 改设置 / 补数据）
//
// 歌词数据与 `@/features/lyrics/parser` 的 LyricLine 结构一致，可直接透传，不做字段映射。

import type { DesktopLyricsSettings } from './settings';

export interface DesktopLyricWord {
  startMs: number;
  durationMs: number;
  text: string;
}

export interface DesktopLyricLine {
  startMs: number;
  durationMs: number;
  text: string;
  words?: DesktopLyricWord[];
}

/** 曲目歌词快照：切歌 / 窗口首次挂载时整首下发一次。 */
export interface DesktopLyricsSnapshot {
  trackId: number | null;
  title: string;
  artist: string;
  lines: DesktopLyricLine[];
  /** 与 `lines` 按下标对齐的翻译文本（没有翻译时为空数组） */
  translations: string[];
}

/**
 * 播放进度锚点。主窗口按 `timeupdate`（约 4Hz）下发，
 * 桌面歌词窗口据此本地插值到 60fps —— 60fps 不走 IPC。
 */
export interface DesktopLyricsPlayback {
  positionMs: number;
  durationMs: number;
  playing: boolean;
  /** 是否有曲目可播（无曲目时工具栏的播放控制置灰） */
  hasTrack: boolean;
}

/** 主窗口 → 桌面歌词窗口：锁定状态 + 排版设置（settings 的唯一真相在主窗口）。 */
export interface DesktopLyricsState {
  locked: boolean;
  settings: DesktopLyricsSettings;
}

/** Rust → 桌面歌词窗口：锁定态下「悬停够久」的揭示（此时窗口临时取消鼠标穿透）。 */
export interface DesktopLyricsReveal {
  revealed: boolean;
}

/** 窗口内设置面板可改的排版项（开关 / 锁定不在这里改）。 */
export type DesktopLyricsLayoutPatch = Partial<
  Pick<DesktopLyricsSettings, 'fontSize' | 'sideLineOpacity' | 'showTranslation'>
>;

/** 桌面歌词窗口 → 主窗口：命令。所有落地动作（settings / 播放器 / 窗口能力）都在主窗口完成。 */
export type DesktopLyricsRequest =
  | { action: 'sync' }
  | { action: 'close' }
  | { action: 'lock' }
  | { action: 'unlock' }
  | { action: 'prev' }
  | { action: 'next' }
  | { action: 'toggle-play' }
  | { action: 'update-layout'; patch: DesktopLyricsLayoutPatch }
  /** 调试用：副窗口的未捕获错误转回主窗口控制台（副窗口没有可达的 devtools） */
  | { action: 'log'; message: string };
