//! 播放器共享状态与事件协议（Phase D：IPC 接线）。
//!
//! 设计 `docs/player-rust-design.md` §3.1 / §4.2。最小落地：现有 `NcmState` / `Database`
//! 仍独立 manage，不做统一 `AppState` 重构（任务规格约束）。

use std::sync::{Arc, Mutex};

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager};

use crate::core::types::{PlayMode, QueueItem};
use crate::core::PlayerEngine;
use crate::infra::storage::db::Database;

/// 播放器状态（设计 §3.1 的最小落地）。
pub struct PlayerState {
    /// 播放器领域引擎 —— 所有播放命令共享同一实例。
    pub engine: Arc<Mutex<PlayerEngine>>,
}

impl Default for PlayerState {
    fn default() -> Self {
        Self {
            engine: Arc::new(Mutex::new(PlayerEngine::new())),
        }
    }
}

impl PlayerState {
    /// 从 SQLite 恢复上次快照（setup 期调用一次）。无记录/失败则保持空引擎。
    pub fn try_restore(&self, db: &Database) {
        if let Some(snapshot) = db.load_player_snapshot() {
            let mut engine = self.engine.lock().unwrap();
            *engine = PlayerEngine::from_snapshot(snapshot);
        }
    }
}

/// 突变后持久化：锁内取快照 → 放锁 → 写 SQLite（锁纪律：不跨锁 await，无嵌套锁）。
pub fn persist_snapshot(app: &AppHandle, player: &PlayerState) {
    let snapshot = {
        let engine = player.engine.lock().unwrap();
        engine.snapshot()
    };
    if let Some(db) = app.try_state::<Database>() {
        db.save_player_snapshot(&snapshot);
    }
}

/// 播放器事件（设计 §4.2，serde tag 精确照抄）：`player:event` 单通道推送，
/// 枚举 tag（即 `player:*`）即事件名，前端按 tag 分发。
#[derive(Serialize)]
#[serde(tag = "event", content = "data")]
pub enum PlayerEvent {
    /// Phase D 不发射（SMTC 媒体键等 Rust 内部路径在 Phase E 推送，设计 §4.4）。
    #[allow(dead_code)]
    #[serde(rename = "player:track-changed")]
    TrackChanged { track: QueueItem },
    #[serde(rename = "player:queue-changed")]
    QueueChanged {
        items: Vec<QueueItem>,
        current_index: Option<usize>,
    },
    #[serde(rename = "player:mode-changed")]
    ModeChanged { mode: PlayMode },
    /// Phase D 不发射（enter/exit_fm 以 PlayUrlInfo 响应为主；镜像在 Phase E）。
    #[allow(dead_code)]
    #[serde(rename = "player:fm-state-changed")]
    FmStateChanged { active: bool },
    #[serde(rename = "player:seek-to")]
    SeekTo { position_secs: f64 },
    #[serde(rename = "player:queue-ended")]
    QueueEnded,
}

/// 发射辅助：`player:event` 单通道推送（设计 §4.2）。
pub fn emit_player_event(app: &AppHandle, event: PlayerEvent) {
    let _ = app.emit("player:event", &event);
}
