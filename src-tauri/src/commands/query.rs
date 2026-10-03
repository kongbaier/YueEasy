//! 播放器查询 IPC 命令（薄壳）：播放 URL 解析。
//! 音频/队列权威已迁前端；本模块只剩「给定 track_id → 播放 URL」的网络取数。

use tauri::{AppHandle, State};

use crate::model::error::Result;
use crate::netease::NcmState;
use crate::service::NcmService;

/// 解析播放 URL（纯网络取数；前端自持曲目元数据，本命令只需 track_id）。
///
/// `Ok(None)` 表示**这首歌不可播**（VIP / 无版权 / 仅试听 —— NCM 侧表现为
/// `data[0].url == null`）。**不可播是正常业务值，不是错误**：前端据此提示并跳过，
/// 只有 `Err`（网络 / 业务 code 失败）才算异常，才需要重试或暂停。
#[tauri::command]
pub(crate) async fn resolve_play_url(
    app_handle: AppHandle,
    ncm: State<'_, NcmState>,
    track_id: u64,
    quality: Option<String>,
) -> Result<Option<String>> {
    let result = NcmService::song_url(&app_handle, &ncm, track_id as i64, quality).await?;
    Ok(result
        .data
        .into_iter()
        .map(|u| u.url)
        .find(|u| !u.is_empty()))
}
