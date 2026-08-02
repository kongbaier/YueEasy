use serde::Serialize;
use tauri::Emitter;
use tauri_plugin_media::{MediaControlEventType, MediaExt};

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
