use std::path::PathBuf;
use tauri::State;

/// Filesystem-backed cache store.
/// Replaces the old SQLite `cache` table.
pub struct CacheState {
    dir: PathBuf,
}

impl CacheState {
    pub fn new(data_dir: &PathBuf) -> Self {
        Self {
            dir: data_dir.join("cache"),
        }
    }

    fn key_path(&self, key: &str) -> PathBuf {
        let safe: String = key
            .chars()
            .map(|c| {
                if c.is_alphanumeric() || c == '-' || c == '_' || c == '.' || c == ':' {
                    c
                } else {
                    '_'
                }
            })
            .collect();
        self.dir.join(format!("{safe}.json"))
    }
}

impl Default for CacheState {
    fn default() -> Self {
        let dir = dirs::data_dir()
            .expect("failed to resolve app data dir")
            .join("com.kongbai.yueeasy");
        CacheState::new(&dir)
    }
}

#[tauri::command]
pub fn cache_get(
    state: State<'_, CacheState>,
    key: String,
) -> Result<Option<String>, String> {
    let path = state.key_path(&key);
    if !path.exists() {
        return Ok(None);
    }
    std::fs::read_to_string(&path)
        .map(Some)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn cache_set(
    state: State<'_, CacheState>,
    key: String,
    value: String,
) -> Result<(), String> {
    std::fs::create_dir_all(&state.dir).ok();
    std::fs::write(state.key_path(&key), &value).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn cache_delete(
    state: State<'_, CacheState>,
    key: String,
) -> Result<(), String> {
    let path = state.key_path(&key);
    if path.exists() {
        std::fs::remove_file(&path).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn cache_clear(
    state: State<'_, CacheState>,
    prefix: String,
) -> Result<(), String> {
    if !state.dir.exists() {
        return Ok(());
    }
    let safe_prefix: String = prefix
        .chars()
        .map(|c| {
            if c.is_alphanumeric() || c == '-' || c == '_' || c == '.' || c == ':' {
                c
            } else {
                '_'
            }
        })
        .collect();

    let entries = std::fs::read_dir(&state.dir).map_err(|e| e.to_string())?;
    for entry in entries {
        if let Ok(entry) = entry {
            let name = entry.file_name().to_string_lossy().into_owned();
            if safe_prefix.is_empty() || name.starts_with(&safe_prefix) {
                std::fs::remove_file(entry.path()).ok();
            }
        }
    }
    Ok(())
}

#[tauri::command]
pub fn cache_size(state: State<'_, CacheState>) -> Result<u64, String> {
    if !state.dir.exists() {
        return Ok(0);
    }
    let mut total = 0u64;
    let entries = std::fs::read_dir(&state.dir).map_err(|e| e.to_string())?;
    for entry in entries {
        if let Ok(entry) = entry {
            if let Ok(meta) = entry.metadata() {
                total += meta.len();
            }
        }
    }
    Ok(total)
}
