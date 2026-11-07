// 桌面歌词窗口 infra：窗口开关（IPC 命令）+ 双窗口事件通道。
//
// 主窗口是唯一权威（开关 / 锁定落在 settings），桌面歌词窗口只读事件、发请求：
//   main ──desktop-lyrics:lyrics──▶ 桌面歌词窗口      （切歌 / 补数据时整首下发）
//   main ──desktop-lyrics:playback──▶ 桌面歌词窗口    （~4Hz 进度锚点）
//   main ──desktop-lyrics:state────▶ 桌面歌词窗口     （锁定状态）
//   桌面歌词窗口 ──desktop-lyrics:request──▶ main     （关闭 / 锁定 / 请求同步）

import { invoke } from '@tauri-apps/api/core';
import { emitTo, listen, type UnlistenFn } from '@tauri-apps/api/event';
import type {
  DesktopLyricsPlayback,
  DesktopLyricsRequest,
  DesktopLyricsReveal,
  DesktopLyricsSnapshot,
  DesktopLyricsState,
} from '@/shared/types/desktopLyrics';

/** 桌面歌词窗口 label（与 Rust `platform::desktop_lyrics::LABEL` 一致）。 */
export const DESKTOP_LYRICS_WINDOW = 'desktop-lyrics';

/** 主窗口 label（Tauri 配置里的 main）。 */
export const MAIN_WINDOW = 'main';

const EVENTS = {
  lyrics: 'desktop-lyrics:lyrics',
  playback: 'desktop-lyrics:playback',
  state: 'desktop-lyrics:state',
  reveal: 'desktop-lyrics:reveal',
  request: 'desktop-lyrics:request',
} as const;

// ── 窗口能力（IPC 命令 → platform::desktop_lyrics） ──

/** 开启（按需创建）/ 关闭桌面歌词窗口。只切可见性，不销毁窗口。 */
export function setDesktopLyricsEnabled(enabled: boolean): Promise<void> {
  return invoke('desktop_lyrics_set_enabled', { enabled });
}

/** 锁定 = 鼠标穿透；解锁后才能拖动 / 点窗口内的控件。 */
export function setDesktopLyricsLocked(locked: boolean): Promise<void> {
  return invoke('desktop_lyrics_set_locked', { locked });
}

/**
 * 窗口高度由窗口自己量好上报（逻辑 px）；宽度由 `tauri.conf.json` 定死（`width` = `maxWidth`）。
 *
 * Rust 侧不算尺寸（不留白、不夹限），只把结果落地并让窗口竖向中心保持不动 ——
 * 高度多少由这个窗口的布局决定，宽度不在两头重复一份真相。
 */
export function setDesktopLyricsHeight(height: number): Promise<void> {
  return invoke('desktop_lyrics_set_height', { height });
}

// ── 主窗口 → 桌面歌词窗口 ──

export function emitDesktopLyricsSnapshot(
  snapshot: DesktopLyricsSnapshot,
): Promise<void> {
  return emitTo(DESKTOP_LYRICS_WINDOW, EVENTS.lyrics, snapshot);
}

export function emitDesktopLyricsPlayback(
  playback: DesktopLyricsPlayback,
): Promise<void> {
  return emitTo(DESKTOP_LYRICS_WINDOW, EVENTS.playback, playback);
}

export function emitDesktopLyricsState(state: DesktopLyricsState): Promise<void> {
  return emitTo(DESKTOP_LYRICS_WINDOW, EVENTS.state, state);
}

// ── 桌面歌词窗口 → 主窗口 ──

export function emitDesktopLyricsRequest(
  request: DesktopLyricsRequest,
): Promise<void> {
  return emitTo(MAIN_WINDOW, EVENTS.request, request);
}

// ── 订阅 ──

export function onDesktopLyricsSnapshot(
  cb: (snapshot: DesktopLyricsSnapshot) => void,
): Promise<UnlistenFn> {
  return listen<DesktopLyricsSnapshot>(EVENTS.lyrics, (event) => {
    cb(event.payload);
  });
}

export function onDesktopLyricsPlayback(
  cb: (playback: DesktopLyricsPlayback) => void,
): Promise<UnlistenFn> {
  return listen<DesktopLyricsPlayback>(EVENTS.playback, (event) => {
    cb(event.payload);
  });
}

export function onDesktopLyricsState(
  cb: (state: DesktopLyricsState) => void,
): Promise<UnlistenFn> {
  return listen<DesktopLyricsState>(EVENTS.state, (event) => {
    cb(event.payload);
  });
}

/** 锁定态的「悬停揭示」由 Rust 观测光标后推送（窗口此时是鼠标穿透的，自己收不到 hover）。 */
export function onDesktopLyricsReveal(
  cb: (reveal: DesktopLyricsReveal) => void,
): Promise<UnlistenFn> {
  return listen<DesktopLyricsReveal>(EVENTS.reveal, (event) => {
    cb(event.payload);
  });
}

export function onDesktopLyricsRequest(
  cb: (request: DesktopLyricsRequest) => void,
): Promise<UnlistenFn> {
  return listen<DesktopLyricsRequest>(EVENTS.request, (event) => {
    cb(event.payload);
  });
}
