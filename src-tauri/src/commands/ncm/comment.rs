//! NCM 评论 IPC 命令（薄壳）：参数透传 → service。

use tauri::{AppHandle, State};

use crate::model::entity::CommentPage;
use crate::model::error::Result;
use crate::netease::NcmState;
use crate::service::NcmService;

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
