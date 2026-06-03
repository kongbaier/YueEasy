use crate::db::connection::Database;
use serde::Serialize;
use tauri::State;

#[derive(Serialize)]
pub struct PlayRecord {
    pub id: i64,
    pub song_id: i64,
    pub song_name: String,
    pub artist: String,
    pub synced: bool,
    pub played_at: String,
}

#[tauri::command]
pub fn history_add(
    db: State<'_, Database>,
    song_id: i64,
    song_name: String,
    artist: String,
) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO play_history (song_id, song_name, artist) VALUES (?1, ?2, ?3)",
        rusqlite::params![song_id, song_name, artist],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn history_get(
    db: State<'_, Database>,
    limit: i64,
    offset: i64,
) -> Result<Vec<PlayRecord>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT id, song_id, song_name, artist, synced, played_at
             FROM play_history
             ORDER BY played_at DESC
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
                synced: row.get::<_, i32>(4)? != 0,
                played_at: row.get(5)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(records)
}

#[tauri::command]
pub fn history_mark_synced(db: State<'_, Database>, ids: Vec<i64>) -> Result<(), String> {
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
