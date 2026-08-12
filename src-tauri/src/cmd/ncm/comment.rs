//! NCM 评论 IPC 命令（薄壳）：参数透传 → service。

use tauri::{AppHandle, State};

use crate::infra::ncm::entity::CommentPage;
use crate::infra::ncm::error::Result;
use crate::infra::ncm::NcmState;
use crate::service::ncm_service::NcmService;

#[tauri::command]
pub(crate) async fn ncm_comment_playlist(
    app_handle: AppHandle,
    state: State<'_, NcmState>,
    id: i64,
    limit: Option<i64>,
    offset: Option<i64>,
) -> Result<CommentPage> {
    NcmService::comment_playlist(&app_handle, &state, id, limit, offset).await
}

#[tauri::command]
pub(crate) async fn ncm_comment_music(
    app_handle: AppHandle,
    state: State<'_, NcmState>,
    id: i64,
    limit: Option<i64>,
    offset: Option<i64>,
) -> Result<CommentPage> {
    NcmService::comment_music(&app_handle, &state, id, limit, offset).await
}
