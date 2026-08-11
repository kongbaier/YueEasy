//! 媒体会话 IPC 命令（薄壳）：透传给 `infra::platform::media_session` 能力。
//! OS 媒体键 → 前端的事件监听在 `infra/platform/media_session::setup`（setup 期注册）。

use serde::Deserialize;
use tauri::{AppHandle, Runtime};

use crate::infra::platform::media_session::{self, MediaSessionMetadata};

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaSessionMetadataArgs {
    pub title: String,
    pub artist: String,
    pub album: String,
    pub duration_secs: f64,
    pub artwork_url: Option<String>,
}

#[tauri::command]
pub(crate) async fn update_media_session_metadata<R: Runtime>(
    app: AppHandle<R>,
    meta: MediaSessionMetadataArgs,
) -> Result<(), String> {
    let m = MediaSessionMetadata {
        title: meta.title,
        artist: meta.artist,
        album: meta.album,
        duration_secs: meta.duration_secs,
        artwork_url: meta.artwork_url,
    };
    media_session::update_metadata(&app, m)
}

#[tauri::command]
pub(crate) async fn update_media_session_status<R: Runtime>(
    app: AppHandle<R>,
    playing: bool,
) -> Result<(), String> {
    media_session::update_status(&app, playing)
}

#[tauri::command]
pub(crate) async fn update_media_session_position<R: Runtime>(
    app: AppHandle<R>,
    position_secs: f64,
) -> Result<(), String> {
    media_session::update_position(&app, position_secs)
}
