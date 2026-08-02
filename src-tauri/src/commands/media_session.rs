use serde::Deserialize;
use tauri::{AppHandle, Runtime};
use tauri_plugin_media::{MediaExt, MediaMetadata, PlaybackStatus};

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaSessionMetadata {
    pub title: String,
    pub artist: String,
    pub album: String,
    pub duration_secs: f64,
    pub artwork_url: Option<String>,
}

#[tauri::command]
pub(crate) async fn update_media_session_metadata<R: Runtime>(
    app: AppHandle<R>,
    meta: MediaSessionMetadata,
) -> Result<(), String> {
    let metadata = MediaMetadata {
        title: meta.title,
        artist: if meta.artist.is_empty() {
            None
        } else {
            Some(meta.artist)
        },
        album: if meta.album.is_empty() {
            None
        } else {
            Some(meta.album)
        },
        album_artist: None,
        duration: Some(meta.duration_secs),
        artwork_url: meta.artwork_url,
        artwork_data: None,
    };

    app.media()
        .set_metadata(metadata)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub(crate) async fn update_media_session_status<R: Runtime>(
    app: AppHandle<R>,
    playing: bool,
) -> Result<(), String> {
    let status = if playing {
        PlaybackStatus::Playing
    } else {
        PlaybackStatus::Paused
    };
    app.media()
        .set_playback_status(status)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub(crate) async fn update_media_session_position<R: Runtime>(
    app: AppHandle<R>,
    position_secs: f64,
) -> Result<(), String> {
    app.media()
        .set_position(position_secs)
        .map_err(|e| e.to_string())
}
