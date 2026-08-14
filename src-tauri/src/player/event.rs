//! 播放器事件协议：Rust → 前端单向状态推送（`player:event` 单通道）。

use serde::Serialize;
use tauri::{AppHandle, Emitter};

use crate::player::state::{ContentSource, Order, QueueItem, Repeat};

#[derive(Serialize)]
#[serde(tag = "event", content = "data")]
pub enum PlayerEvent {
    #[serde(rename = "player:current")]
    Current {
        track: Option<QueueItem>,
        index: Option<usize>,
        source: ContentSource,
        order: Order,
        repeat: Repeat,
    },

    #[serde(rename = "player:queue")]
    Queue {
        items: Vec<QueueItem>,
        current_index: Option<usize>,
    },

    #[serde(rename = "player:playing")]
    Playing { playing: bool },
}

pub fn emit_player_event(app: &AppHandle, event: PlayerEvent) {
    let _ = app.emit("player:event", &event);
}
