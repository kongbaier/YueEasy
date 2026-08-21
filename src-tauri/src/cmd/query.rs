//! 播放器查询 IPC 命令（薄壳）：播放 URL 解析。
//! 音频/队列权威已迁前端；本模块只剩「给定 track_id → 播放 URL」的网络取数。

use tauri::{AppHandle, State};

use crate::music::netease::NcmState;
use crate::music::service::NcmService;

/// 解析播放 URL（纯网络取数；前端自持曲目元数据，本命令只需 track_id）。
/// 返回第一条非空 url。
#[tauri::command]
pub(crate) async fn resolve_play_url(
    app_handle: AppHandle,
    ncm: State<'_, NcmState>,
    track_id: u64,
    quality: Option<String>,
) -> Result<String, String> {
    let result = NcmService::song_url(&app_handle, &ncm, track_id as i64, quality)
        .await
        .map_err(|e| e.to_string())?;
    result
        .data
        .into_iter()
        .map(|u| u.url)
        .find(|u| !u.is_empty())
        .ok_or_else(|| format!("无法获取曲目 {track_id} 的播放地址"))
}
