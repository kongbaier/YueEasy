use crate::db::connection::Database;
use tauri::State;

#[tauri::command]
pub fn get_setting(db: State<'_, Database>, key: String) -> Result<String, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.query_row("SELECT value FROM settings WHERE key = ?1", [&key], |row| {
        row.get(0)
    })
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn set_setting(db: State<'_, Database>, key: String, value: String) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT OR REPLACE INTO settings (key, value) VALUES (?1, ?2)",
        [&key, &value],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}
