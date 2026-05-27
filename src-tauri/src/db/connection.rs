use rusqlite::Connection;
use std::path::PathBuf;
use std::sync::Mutex;

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
            "CREATE TABLE IF NOT EXISTS settings (
                key   TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS cache (
                key        TEXT PRIMARY KEY,
                value      TEXT NOT NULL,
                updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS play_history (
                id        INTEGER PRIMARY KEY AUTOINCREMENT,
                song_id   INTEGER NOT NULL,
                song_name TEXT NOT NULL,
                artist    TEXT DEFAULT '',
                synced    INTEGER DEFAULT 0,
                played_at TEXT DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS downloads (
                id        INTEGER PRIMARY KEY AUTOINCREMENT,
                song_id   INTEGER NOT NULL UNIQUE,
                song_name TEXT NOT NULL,
                file_path TEXT NOT NULL,
                file_size INTEGER DEFAULT 0,
                status    TEXT DEFAULT 'pending',
                created_at TEXT DEFAULT (datetime('now'))
            );",
        )?;
        Ok(())
    }
}
