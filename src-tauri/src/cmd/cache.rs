//! 缓存 IPC 命令（薄壳）：参数透传 → CacheState。

use tauri::State;

use crate::storage::cache::CacheState;

#[tauri::command]
pub(crate) fn cache_get(
    state: State<'_, CacheState>,
    key: String,
) -> Result<Option<String>, String> {
    state.get(&key)
}

#[tauri::command]
pub(crate) fn cache_set(
    state: State<'_, CacheState>,
    key: String,
    value: String,
) -> Result<(), String> {
    state.set(&key, &value)
}

#[tauri::command]
pub(crate) fn cache_delete(state: State<'_, CacheState>, key: String) -> Result<(), String> {
    state.delete(&key)
}

#[tauri::command]
pub(crate) fn cache_clear(state: State<'_, CacheState>, prefix: String) -> Result<(), String> {
    state.clear(&prefix)
}

#[tauri::command]
pub(crate) fn cache_size(state: State<'_, CacheState>) -> Result<u64, String> {
    state.size()
}
