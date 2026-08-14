use rusqlite::Connection;
use std::path::PathBuf;
use std::sync::Mutex;

use crate::player::state::PlayerSnapshot;

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
        // Phase F：播放器状态快照（崩溃/重启续播）。只追加新表，不动 play_history。
        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS player_snapshot (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );",
        )?;
        Ok(())
    }

    /// 保存播放器快照（JSON，单行 key='current'）。错误静默忽略（WAL 模式 + 非关键路径）。
    pub fn save_player_snapshot(&self, snapshot: &PlayerSnapshot) {
        if let Ok(json) = serde_json::to_string(snapshot) {
            let conn = self.conn.lock().unwrap();
            let _ = conn.execute(
                "INSERT OR REPLACE INTO player_snapshot (key, value) VALUES ('current', ?1)",
                rusqlite::params![json],
            );
        }
    }

    /// 加载上次保存的快照。无记录/解析失败 → None。
    pub fn load_player_snapshot(&self) -> Option<PlayerSnapshot> {
        let conn = self.conn.lock().unwrap();
        let json: String = conn
            .query_row("SELECT value FROM player_snapshot WHERE key = 'current'", [], |row| {
                row.get(0)
            })
            .ok()?;
        serde_json::from_str(&json).ok()
    }
}

impl Default for Database {
    fn default() -> Self {
        Database::new(paths::data_dir()).expect("failed to open database")
    }
}
