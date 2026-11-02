//! 音频缓存 IPC 命令（薄壳）：透传 `storage::audio_cache` / `service::audio_cache`。
//!
//! 「播 URL → 本地文件」的落盘、容量淘汰都在下层；命令层只做参数与返回值转换。

use tauri::State;

use crate::service::audio_cache as audio_cache_service;
use crate::storage::audio_cache::{AudioCache, AudioCacheStats};

/// 命中返回本地绝对路径（前端用 `convertFileSrc` 转 asset URL），未命中 `null`。
#[tauri::command]
pub(crate) fn audio_cache_get(
    cache: State<'_, AudioCache>,
    track_id: u64,
    level: Option<String>,
) -> Option<String> {
    cache
        .get(track_id, level.as_deref())
        .map(|p| p.to_string_lossy().into_owned())
}

/// 缓存目录绝对路径（设置页展示用）。
#[tauri::command]
pub(crate) fn audio_cache_dir(cache: State<'_, AudioCache>) -> String {
    cache.dir().to_string_lossy().into_owned()
}

/// 请求后台落盘（fire-and-forget：立刻返回，成败只留日志）。
#[tauri::command]
pub(crate) fn audio_cache_request(
    cache: State<'_, AudioCache>,
    track_id: u64,
    url: String,
    level: Option<String>,
) {
    audio_cache_service::spawn_download(cache.inner().clone(), track_id, url, level);
}

/// 下发容量上限（字节，`0` = 关闭缓存）。
#[tauri::command]
pub(crate) fn audio_cache_set_limit(cache: State<'_, AudioCache>, max_bytes: u64) {
    cache.set_limit(max_bytes);
}

#[tauri::command]
pub(crate) fn audio_cache_stats(cache: State<'_, AudioCache>) -> AudioCacheStats {
    cache.stats()
}

#[tauri::command]
pub(crate) fn audio_cache_clear(cache: State<'_, AudioCache>) -> Result<(), String> {
    cache.clear()
}

/// 删除某曲目的所有音质变体（音频加载失败后重解析时调用）。
#[tauri::command]
pub(crate) fn audio_cache_remove(cache: State<'_, AudioCache>, track_id: u64) {
    cache.remove(track_id);
}
