//! 文件型缓存存储（基础能力，无命令层）。
//! IPC 命令见 `cmd/cache.rs`。

use std::path::{Path, PathBuf};

use super::paths;

/// Filesystem-backed cache store.
pub struct CacheState {
    dir: PathBuf,
}

/// 把任意缓存键清洗成合法文件名片段（Windows 不允许 `:` `/` `\` `?` `*` 等）。
/// 只保留字母数字与 `-` `_` `.`，其余一律替换为 `_`。
/// `key_path` 与 `clear` 共用，保证前后缀匹配一致。
fn sanitize_key(key: &str) -> String {
    key.chars()
        .map(|c| {
            if c.is_alphanumeric() || c == '-' || c == '_' || c == '.' {
                c
            } else {
                '_'
            }
        })
        .collect()
}

impl CacheState {
    pub fn new(data_dir: &Path) -> Self {
        Self {
            dir: data_dir.join("cache"),
        }
    }

    fn key_path(&self, key: &str) -> PathBuf {
        self.dir.join(format!("{}.json", sanitize_key(key)))
    }

    pub fn get(&self, key: &str) -> Result<Option<String>, String> {
        let path = self.key_path(key);
        if !path.exists() {
            return Ok(None);
        }
        std::fs::read_to_string(&path)
            .map(Some)
            .map_err(|e| e.to_string())
    }

    pub fn set(&self, key: &str, value: &str) -> Result<(), String> {
        std::fs::create_dir_all(&self.dir).ok();
        std::fs::write(self.key_path(key), value).map_err(|e| e.to_string())
    }

    pub fn delete(&self, key: &str) -> Result<(), String> {
        let path = self.key_path(key);
        if path.exists() {
            std::fs::remove_file(&path).map_err(|e| e.to_string())?;
        }
        Ok(())
    }

    pub fn clear(&self, prefix: &str) -> Result<(), String> {
        if !self.dir.exists() {
            return Ok(());
        }
        let safe_prefix = sanitize_key(prefix);

        let entries = std::fs::read_dir(&self.dir).map_err(|e| e.to_string())?;
        for entry in entries.flatten() {
            let name = entry.file_name().to_string_lossy().into_owned();
            if safe_prefix.is_empty() || name.starts_with(&safe_prefix) {
                std::fs::remove_file(entry.path()).ok();
            }
        }
        Ok(())
    }

    pub fn size(&self) -> Result<u64, String> {
        if !self.dir.exists() {
            return Ok(0);
        }
        let mut total = 0u64;
        let entries = std::fs::read_dir(&self.dir).map_err(|e| e.to_string())?;
        for entry in entries.flatten() {
            if let Ok(meta) = entry.metadata() {
                total += meta.len();
            }
        }
        Ok(total)
    }
}

impl Default for CacheState {
    fn default() -> Self {
        CacheState::new(&paths::data_dir())
    }
}
