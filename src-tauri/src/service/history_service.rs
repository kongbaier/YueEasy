//! 播放历史领域服务：浅包 `infra::storage::play_history`。IPC 薄壳在 `cmd/history.rs`。

use crate::infra::storage::db::Database;
use crate::infra::storage::play_history::{self, PlayRecord};

pub struct HistoryService;

impl HistoryService {
    pub fn add(
        db: &Database,
        song_id: i64,
        song_name: String,
        artist: String,
    ) -> Result<(), String> {
        play_history::add(db, song_id, song_name, artist)
    }

    pub fn get(db: &Database, limit: i64, offset: i64) -> Result<Vec<PlayRecord>, String> {
        play_history::get(db, limit, offset)
    }

    pub fn mark_synced(db: &Database, ids: Vec<i64>) -> Result<(), String> {
        play_history::mark_synced(db, ids)
    }
}
