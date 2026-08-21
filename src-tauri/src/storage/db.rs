use rusqlite::Connection;
use std::path::PathBuf;
use std::sync::Mutex;

use super::paths;

pub struct Database {
    pub conn: Mutex<Connection>,
}

impl Database {
    pub fn new(app_data_dir: PathBuf) -> Result<Self, rusqlite::Error> {
        std::fs::create_dir_all(&app_data_dir).ok();
        let db_path = app_data_dir.join("yueeasy.db");
        let conn = Connection::open(db_path)?;
        Self::migrate(&conn)?;
        Ok(Self {
            conn: Mutex::new(conn),
        })
    }

    fn migrate(conn: &Connection) -> Result<(), rusqlite::Error> {
        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS play_history (
                id        INTEGER PRIMARY KEY AUTOINCREMENT,
                song_id   INTEGER NOT NULL,
                song_name TEXT NOT NULL,
                artist    TEXT DEFAULT '',
                synced    INTEGER DEFAULT 0,
                played_at TEXT DEFAULT (datetime('now'))
            );",
        )?;
        Ok(())
    }
}

impl Default for Database {
    fn default() -> Self {
        Database::new(paths::data_dir()).expect("failed to open database")
    }
}
