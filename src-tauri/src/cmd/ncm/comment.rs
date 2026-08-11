//! NCM 评论 IPC 命令（薄壳）：参数透传 → use_case。

use tauri::{AppHandle, State};

use crate::infra::ncm::entity::CommentPage;
use crate::infra::ncm::error::Result;
use crate::infra::ncm::NcmState;
use crate::use_case::ncm::NcmUseCase;

#[tauri::command]
pub(crate) async fn ncm_comment_playlist(
    app_handle: AppHandle,
    state: State<'_, NcmState>,
    id: i64,
    limit: Option<i64>,
    offset: Option<i64>,
) -> Result<CommentPage> {
    NcmUseCase::comment_playlist(&app_handle, &state, id, limit, offset).await
}

#[tauri::command]
pub(crate) async fn ncm_comment_music(
    app_handle: AppHandle,
    state: State<'_, NcmState>,
    id: i64,
    limit: Option<i64>,
    offset: Option<i64>,
) -> Result<CommentPage> {
    NcmUseCase::comment_music(&app_handle, &state, id, limit, offset).await
}
