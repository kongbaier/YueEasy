//! 播放历史 IPC 命令（薄壳）：参数透传 → service 层。

use tauri::State;

use crate::infra::storage::db::Database;
use crate::infra::storage::play_history::PlayRecord;
use crate::service::history_service::HistoryService;

#[tauri::command]
pub(crate) fn history_add(
    db: State<'_, Database>,
    song_id: i64,
    song_name: String,
    artist: String,
) -> Result<(), String> {
    HistoryService::add(&db, song_id, song_name, artist)
}

#[tauri::command]
pub(crate) fn history_get(
    db: State<'_, Database>,
    limit: i64,
    offset: i64,
) -> Result<Vec<PlayRecord>, String> {
    HistoryService::get(&db, limit, offset)
}

#[tauri::command]
pub(crate) fn history_mark_synced(db: State<'_, Database>, ids: Vec<i64>) -> Result<(), String> {
    HistoryService::mark_synced(&db, ids)
}
