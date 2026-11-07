//! 桌面歌词 IPC 命令（薄壳）：透传给 `platform::desktop_lyrics`。
//! 窗口内容与播放进度同步走在两个 WebView 之间的事件通道（`@/tauri/desktopLyrics`），不经过 IPC 命令。

use tauri::{AppHandle, Runtime};

use crate::platform::desktop_lyrics;

#[tauri::command]
pub(crate) async fn desktop_lyrics_set_enabled<R: Runtime>(
    app: AppHandle<R>,
    enabled: bool,
) -> Result<(), String> {
    desktop_lyrics::set_enabled(&app, enabled)
}

#[tauri::command]
pub(crate) async fn desktop_lyrics_set_locked<R: Runtime>(
    app: AppHandle<R>,
    locked: bool,
) -> Result<(), String> {
    desktop_lyrics::set_locked(&app, locked)
}

/// 窗口高度由副窗口自己量好上报（逻辑 px）；宽度由 `tauri.conf.json` 定死。
#[tauri::command]
pub(crate) async fn desktop_lyrics_set_height<R: Runtime>(
    app: AppHandle<R>,
    height: f64,
) -> Result<(), String> {
    desktop_lyrics::set_height(&app, height)
}
