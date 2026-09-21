//! 播放历史 IPC 命令（薄壳）：参数透传 → storage::play_history。

use tauri::State;

use crate::storage::db::Database;
use crate::storage::play_history::{self, NewPlayRecord, PlayRecord};

#[tauri::command]
pub(crate) fn history_add(
    db: State<'_, Database>,
    record: NewPlayRecord,
) -> Result<(), String> {
    play_history::add(&db, &record)
}

#[tauri::command]
pub(crate) fn history_get(
    db: State<'_, Database>,
    limit: i64,
    offset: i64,
) -> Result<Vec<PlayRecord>, String> {
    play_history::get(&db, limit, offset)
}

#[tauri::command]
pub(crate) fn history_mark_synced(db: State<'_, Database>, ids: Vec<i64>) -> Result<(), String> {
    play_history::mark_synced(&db, ids)
}
