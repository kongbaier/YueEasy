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
                id            INTEGER PRIMARY KEY AUTOINCREMENT,
                song_id       INTEGER NOT NULL,
                song_name     TEXT NOT NULL,
                artist        TEXT DEFAULT '',
                synced        INTEGER DEFAULT 0,
                played_at     TEXT DEFAULT (datetime('now')),
                album         TEXT DEFAULT '',
                cover_url     TEXT DEFAULT '',
                duration_secs INTEGER DEFAULT 0,
                played_at_ms  INTEGER DEFAULT 0
            );",
        )?;
        // 兼容既有库：CREATE TABLE IF NOT EXISTS 不会给旧表补列，逐列检查缺失后 ALTER。
        for (col, ddl) in [
            ("album", "ALTER TABLE play_history ADD COLUMN album TEXT DEFAULT ''"),
            (
                "cover_url",
                "ALTER TABLE play_history ADD COLUMN cover_url TEXT DEFAULT ''",
            ),
            (
                "duration_secs",
                "ALTER TABLE play_history ADD COLUMN duration_secs INTEGER DEFAULT 0",
            ),
            (
                "played_at_ms",
                "ALTER TABLE play_history ADD COLUMN played_at_ms INTEGER DEFAULT 0",
            ),
        ] {
            if !existing_columns(conn, "play_history")?.contains(&col.to_string()) {
                conn.execute_batch(ddl)?;
            }
        }
        Ok(())
    }
}

impl Default for Database {
    fn default() -> Self {
        Database::new(paths::data_dir()).expect("failed to open database")
    }
}

/// 读取一张表的现有列名（PRAGMA table_info 的第 2 列）。用于轻量迁移判断。
fn existing_columns(conn: &Connection, table: &str) -> Result<Vec<String>, rusqlite::Error> {
    let mut stmt = conn.prepare(&format!("PRAGMA table_info({table})"))?;
    let cols = stmt.query_map([], |row| row.get::<_, String>(1))?;
    cols.collect::<Result<Vec<_>, _>>()
}
