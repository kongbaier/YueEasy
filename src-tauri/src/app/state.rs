//! 应用共享状态：播放器状态（引擎 + 音频 + URL 缓存）+ 点赞状态。

use std::collections::HashSet;
use std::sync::{Arc, Mutex};

use tauri::{AppHandle, Manager};

use crate::storage::db::Database;
use crate::player::QueueEngine;
use crate::player::audio::AudioEngine;

/// 播放器状态：所有播放命令共享同一实例。
pub struct PlayerState {
    pub engine: Arc<Mutex<QueueEngine>>,
    pub audio: Arc<Mutex<AudioEngine>>,
    pub last_url: Arc<Mutex<Option<(u64, String)>>>,
}

impl Default for PlayerState {
    fn default() -> Self {
        Self {
            engine: Arc::new(Mutex::new(QueueEngine::new())),
            audio: Arc::new(Mutex::new(
                AudioEngine::new().expect("failed to init audio device"),
            )),
            last_url: Arc::new(Mutex::new(None)),
        }
    }
}

impl PlayerState {
    pub fn try_restore(&self, db: &Database) {
        if let Some(snapshot) = db.load_player_snapshot() {
            let mut engine = self.engine.lock().unwrap();
            *engine = QueueEngine::from_snapshot(snapshot);
        }
    }
}

/// 突变后持久化：锁内取快照 → 放锁 → 写 SQLite。
pub fn persist_snapshot(app: &AppHandle, player: &PlayerState) {
    let snapshot = {
        let engine = player.engine.lock().unwrap();
        engine.snapshot()
    };
    if let Some(db) = app.try_state::<Database>() {
        db.save_player_snapshot(&snapshot);
    }
}

/// 点赞状态：liked_ids 的权威集合在 Rust。
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
