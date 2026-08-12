use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Runtime};
use tauri_plugin_media::{
    InitializeMediaSessionRequest, MediaControlEventType, MediaExt, MediaMetadata, PlaybackStatus,
};

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
    // 必调：启用 SystemMediaTransportControls 整体 + 各按钮（Play/Pause/Next/Prev/Stop）。
    // 不调则 Windows 媒体面板不出现本应用会话；Linux MPRIS 服务根本不起。
    // app_id/app_name 在 Windows 上忽略；Linux 用 app_id 拼 org.mpris.MediaPlayer2.{app_id}，
    // app_name 作为 MPRIS Identity 名称显示。
    handle.media().initialize_session(InitializeMediaSessionRequest {
        app_id: "com.kongbai.yueeasy".to_string(),
        app_name: "YueEasy".to_string(),
    })?;

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
            MediaControlEventType::SetPlaybackRate(rate) => {
                MediaSessionEvent::SetPlaybackRate { rate }
            }
        };
        let _ = h.emit("media-session-event", payload);
    });
    Ok(())
}

// ── 方向二：前端 → OS 媒体会话（SMTC）更新能力 ──────────────────────────

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaSessionMetadata {
    pub title: String,
    pub artist: String,
    pub album: String,
    pub duration_secs: f64,
    pub artwork_url: Option<String>,
}

pub(crate) fn update_metadata<R: Runtime>(
    app: &AppHandle<R>,
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

pub(crate) fn update_status<R: Runtime>(app: &AppHandle<R>, playing: bool) -> Result<(), String> {
    let status = if playing {
        PlaybackStatus::Playing
    } else {
        PlaybackStatus::Paused
    };
    app.media()
        .set_playback_status(status)
        .map_err(|e| e.to_string())
}

pub(crate) fn update_position<R: Runtime>(
    app: &AppHandle<R>,
    position_secs: f64,
) -> Result<(), String> {
    app.media()
        .set_position(position_secs)
        .map_err(|e| e.to_string())
}
