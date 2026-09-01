//! 播放历史领域服务（无命令层）。IPC 命令见 `cmd/history.rs`。

use crate::storage::db::Database;
use serde::{Deserialize, Serialize};

/// 前端写入的本地播放记录（字段即 IPC wire 名，snake_case 与 QueueItem 同约定）。
#[derive(Deserialize)]
pub struct NewPlayRecord {
    pub song_id: i64,
    pub song_name: String,
    pub artist: String,
    pub album: String,
    pub cover_url: String,
    pub duration_secs: i64,
    pub played_at_ms: i64,
}

#[derive(Serialize)]
pub struct PlayRecord {
    pub id: i64,
    pub song_id: i64,
    pub song_name: String,
    pub artist: String,
    pub album: String,
    pub cover_url: String,
    pub duration_secs: i64,
    pub synced: bool,
    pub played_at: String,
    pub played_at_ms: i64,
}

/// 本地播放记录上限（对齐网易云云记录约 300 首；去重后每首一行）。
const MAX_LOCAL_RECORDS: i64 = 300;

/// 写入一条本地播放记录；同一首歌只保留 `played_at_ms` 最新一条，且全表截断在最近 300 首。
pub fn add(db: &Database, record: &NewPlayRecord) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO play_history
            (song_id, song_name, artist, album, cover_url, duration_secs, played_at_ms)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        rusqlite::params![
            record.song_id,
            record.song_name,
            record.artist,
            record.album,
            record.cover_url,
            record.duration_secs,
            record.played_at_ms
        ],
    )
    .map_err(|e| e.to_string())?;
    // 清理同曲旧行，仅留最新一条（唯一性）
    conn.execute(
        "DELETE FROM play_history
         WHERE song_id = ?1 AND id != (
             SELECT id FROM play_history WHERE song_id = ?1
             ORDER BY played_at_ms DESC, id DESC LIMIT 1
         )",
        [record.song_id],
    )
    .map_err(|e| e.to_string())?;
    // 对齐云记录上限：全表只保留最近 300 首，超出淘汰最旧
    conn.execute(
        "DELETE FROM play_history
         WHERE id NOT IN (
             SELECT id FROM play_history
             ORDER BY played_at_ms DESC, id DESC
             LIMIT ?1
         )",
        [MAX_LOCAL_RECORDS],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

/// 按曲目去重（每曲仅最新一条），`played_at_ms` 倒序。
pub fn get(db: &Database, limit: i64, offset: i64) -> Result<Vec<PlayRecord>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT h.id, h.song_id, h.song_name, h.artist, h.album, h.cover_url, h.duration_secs,
                    h.synced, h.played_at, h.played_at_ms
             FROM play_history h
             WHERE h.played_at_ms = (
                 SELECT MAX(played_at_ms) FROM play_history WHERE song_id = h.song_id
             )
             ORDER BY h.played_at_ms DESC
             LIMIT ?1 OFFSET ?2",
        )
        .map_err(|e| e.to_string())?;

    let records = stmt
        .query_map(rusqlite::params![limit, offset], |row| {
            Ok(PlayRecord {
                id: row.get(0)?,
                song_id: row.get(1)?,
                song_name: row.get(2)?,
                artist: row.get(3)?,
                album: row.get(4)?,
                cover_url: row.get(5)?,
                duration_secs: row.get(6)?,
                synced: row.get::<_, i32>(7)? != 0,
                played_at: row.get(8)?,
                played_at_ms: row.get(9)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(records)
}

pub fn mark_synced(db: &Database, ids: Vec<i64>) -> Result<(), String> {
    if ids.is_empty() {
        return Ok(());
    }
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    for id in ids {
        conn.execute("UPDATE play_history SET synced = 1 WHERE id = ?1", [id])
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}
