use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Runtime};
use tauri_plugin_media::{MediaControlEventType, MediaExt, MediaMetadata, PlaybackStatus};

// ── 方向一：OS 媒体键/系统媒体控制 → 前端 ───────────────────────────────

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "event", rename_all = "camelCase")]
enum MediaSessionEvent {
    Play,
    Pause,
    Toggle,
    Next,
    Previous,
    Stop,
    FastForward,
    Rewind,
    #[serde(rename = "seekTo")]
    SeekTo {
        position: f64,
    },
    #[serde(rename = "setPlaybackRate")]
    SetPlaybackRate {
        rate: f64,
    },
}

pub fn setup<R: tauri::Runtime>(
    handle: &tauri::AppHandle<R>,
) -> Result<(), Box<dyn std::error::Error>> {
    let h = handle.clone();
    handle.media().set_event_handler(move |event| {
        let payload = match event.event_type {
            MediaControlEventType::Play => MediaSessionEvent::Play,
            MediaControlEventType::Pause => MediaSessionEvent::Pause,
            MediaControlEventType::PlayPause => MediaSessionEvent::Toggle,
            MediaControlEventType::Stop => MediaSessionEvent::Stop,
            MediaControlEventType::Next => MediaSessionEvent::Next,
            MediaControlEventType::Previous => MediaSessionEvent::Previous,
            MediaControlEventType::FastForward => MediaSessionEvent::FastForward,
            MediaControlEventType::Rewind => MediaSessionEvent::Rewind,
            MediaControlEventType::SeekTo(pos) => MediaSessionEvent::SeekTo { position: pos },
            MediaControlEventType::SetPosition(pos) => MediaSessionEvent::SeekTo { position: pos },
            MediaControlEventType::SetPlaybackRate(rate) => MediaSessionEvent::SetPlaybackRate { rate },
        };
        let _ = h.emit("media-session-event", payload);
    });
    Ok(())
}

// ── 方向二：前端 → OS 媒体会话（SMTC）更新 ──────────────────────────────

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
