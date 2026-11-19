//! 播放器查询 IPC 命令（薄壳）：播放 URL 解析。
//! 音频/队列权威已迁前端；本模块只剩「给定 track_id + 音质 → 播放 URL」的网络取数。

use tauri::State;

use crate::model::entity::PlayUrl;
use crate::model::error::Result;
use crate::netease::NcmState;
use crate::service::NcmService;

/// 解析播放 URL（纯网络取数；前端自持曲目元数据，本命令只需 track_id + 音质档位）。
///
/// `quality` 是 NCM 客户端的 `level` 取值（`standard` / `higher` / `exhigh` /
/// `lossless` / `hires` / `jymaster` / `sky`）；`None` 时按 `exhigh`（320k）请求。
/// 返回值带**实际**档位与码率：服务端会按账号权限静默降级（非 VIP 请求 `lossless`
/// 回 `exhigh`），前端据此展示真实音质，而不是只显示「我请求了什么」。
///
/// `Ok(None)` 表示**这首歌不可播**（VIP / 无版权 / 仅试听 —— NCM 侧表现为
/// `data[0].url == null`）。**不可播是正常业务值，不是错误**：前端据此提示并跳过，
/// 只有 `Err`（网络 / 业务 code 失败）才算异常，才需要重试或暂停。
#[tauri::command]
pub(crate) async fn resolve_play_url(
    ncm: State<'_, NcmState>,
    track_id: u64,
    quality: Option<String>,
) -> Result<Option<PlayUrl>> {
    NcmService::play_url(&ncm, track_id as i64, quality).await
}
