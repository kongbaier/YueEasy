//! 播放器共享状态与事件协议（Phase D：IPC 接线）。
//!
//! 设计 `docs/player-rust-design.md` §3.1 / §4.2。最小落地：现有 `NcmState` / `Database`
//! 仍独立 manage，不做统一 `AppState` 重构（任务规格约束）。

use std::collections::HashSet;
use std::sync::{Arc, Mutex};

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager};

use crate::core::types::{ContentSource, Order, QueueItem, Repeat};
use crate::core::PlayerEngine;
use crate::infra::audio::engine::AudioEngine;
use crate::infra::storage::db::Database;

/// 播放器状态（设计 §3.1 的最小落地）。
pub struct PlayerState {
    /// 播放器领域引擎 —— 所有播放命令共享同一实例。
    pub engine: Arc<Mutex<PlayerEngine>>,
    /// 音频播放引擎 —— rodio + stream-download，播放/暂停/seek/音量的真实执行者。
    pub audio: Arc<Mutex<AudioEngine>>,
    /// 最近一次成功 resolve 的播放 URL（LoopOne 重播时复用，避免重复 NCM 请求）。
    /// `(track_id, url)`：track_id 用于匹配当前曲，防止旧缓存命中。
    pub last_url: Arc<Mutex<Option<(u64, String)>>>,
}

impl Default for PlayerState {
    fn default() -> Self {
        Self {
            engine: Arc::new(Mutex::new(PlayerEngine::new())),
            audio: Arc::new(Mutex::new(
                AudioEngine::new().expect("failed to init audio device"),
            )),
            last_url: Arc::new(Mutex::new(None)),
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

/// 播放器事件（设计 §4.2，精简为 3 条核心）：
/// `player:event` 单通道推送，枚举 tag（即 `player:*`）即事件名，前端按 tag 分发。
#[derive(Serialize)]
#[serde(tag = "event", content = "data")]
pub enum PlayerEvent {
    /// 当前曲目 + 索引 + 内容来源 + 遍历顺序 + 终止策略（合并原 track/strategy/source/index 四类变化）。
    #[serde(rename = "player:current")]
    Current {
        track: Option<QueueItem>,
        index: Option<usize>,
        source: ContentSource,
        order: Order,
        repeat: Repeat,
    },
    /// 队列全量（仅队列结构变化时推，去抖由调用方控制）。
    #[serde(rename = "player:queue")]
    Queue {
        items: Vec<QueueItem>,
        current_index: Option<usize>,
    },
    /// 播放状态（true 播放 / false 暂停或结束；合并原 status-changed / queue-ended）。
    #[serde(rename = "player:playing")]
    Playing { playing: bool },
}

/// 发射辅助：`player:event` 单通道推送（设计 §4.2）。
pub fn emit_player_event(app: &AppHandle, event: PlayerEvent) {
    let _ = app.emit("player:event", &event);
}

/// 点赞状态（音频迁移后的下一批业务迁移）：liked_ids 的权威集合在 Rust，
/// 前端读镜像 + 乐观更新，`like_toggle` 命令内更新并推 `liked-toggled` 事件。
pub struct LikeState {
    pub liked_ids: Arc<Mutex<HashSet<u64>>>,
}

impl Default for LikeState {
    fn default() -> Self {
        Self {
            liked_ids: Arc::new(Mutex::new(HashSet::new())),
        }
    }
}
