use crate::db::connection::Database;
use tauri::State;

#[tauri::command]
pub fn cache_get(db: State<'_, Database>, key: String) -> Result<Option<String>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    match conn.query_row(
        "SELECT value FROM cache WHERE key = ?1",
        [&key],
        |row| row.get::<_, String>(0),
    ) {
        Ok(v) => Ok(Some(v)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
pub fn cache_set(db: State<'_, Database>, key: String, value: String) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT OR REPLACE INTO cache (key, value, updated_at) VALUES (?1, ?2, datetime('now'))",
        rusqlite::params![key, value],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn cache_delete(db: State<'_, Database>, key: String) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM cache WHERE key = ?1", [&key])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn cache_clear(db: State<'_, Database>, prefix: String) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "DELETE FROM cache WHERE key LIKE ?1",
        [format!("{prefix}%")],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}
