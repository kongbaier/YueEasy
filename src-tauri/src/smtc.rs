use serde::Serialize;
use tauri::Emitter;
use tauri_plugin_media::{MediaControlEventType, MediaExt};

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "event", rename_all = "camelCase")]
enum SmtcEvent {
    Play,
    Pause,
    Toggle,
    Next,
    Previous,
    Stop,
    FastForward,
    Rewind,
    #[serde(rename = "setPosition")]
    SetPosition {
        position: f64,
    },
    #[serde(rename = "seekTo")]
    SeekTo {
        position: f64,
    },
    #[serde(rename = "setPlaybackRate")]
    SetPlaybackRate {
        rate: f64,
    },
}

pub fn setup(handle: &tauri::AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let h = handle.clone();
    handle.media().set_event_handler(move |event| {
        let payload = match event.event_type {
            MediaControlEventType::Play => SmtcEvent::Play,
            MediaControlEventType::Pause => SmtcEvent::Pause,
            MediaControlEventType::PlayPause => SmtcEvent::Toggle,
            MediaControlEventType::Stop => SmtcEvent::Stop,
            MediaControlEventType::Next => SmtcEvent::Next,
            MediaControlEventType::Previous => SmtcEvent::Previous,
            MediaControlEventType::FastForward => SmtcEvent::FastForward,
            MediaControlEventType::Rewind => SmtcEvent::Rewind,
            MediaControlEventType::SeekTo(pos) => SmtcEvent::SeekTo { position: pos },
            MediaControlEventType::SetPosition(pos) => SmtcEvent::SetPosition { position: pos },
            MediaControlEventType::SetPlaybackRate(rate) => SmtcEvent::SetPlaybackRate { rate },
        };
        let _ = h.emit("smtc-event", payload);
    });
    Ok(())
}
