//! 缓存 IPC 命令（薄壳）：参数透传 → service 层。

use tauri::State;

use crate::infra::storage::cache::CacheState;
use crate::service::cache_service::CacheService;

#[tauri::command]
pub(crate) fn cache_get(
    state: State<'_, CacheState>,
    key: String,
) -> Result<Option<String>, String> {
    CacheService::get(&state, &key)
}

#[tauri::command]
pub(crate) fn cache_set(
    state: State<'_, CacheState>,
    key: String,
    value: String,
) -> Result<(), String> {
    CacheService::set(&state, &key, &value)
}

#[tauri::command]
pub(crate) fn cache_delete(state: State<'_, CacheState>, key: String) -> Result<(), String> {
    CacheService::delete(&state, &key)
}

#[tauri::command]
pub(crate) fn cache_clear(state: State<'_, CacheState>, prefix: String) -> Result<(), String> {
    CacheService::clear(&state, &prefix)
}

#[tauri::command]
pub(crate) fn cache_size(state: State<'_, CacheState>) -> Result<u64, String> {
    CacheService::size(&state)
}
