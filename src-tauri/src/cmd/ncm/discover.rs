//! NCM 发现页 IPC 命令（薄壳）：参数透传 → use_case。

use tauri::{AppHandle, State};

use crate::infra::ncm::entity::{Banner, DragonBallItem, IntelligenceSong, Song};
use crate::infra::ncm::error::Result;
use crate::infra::ncm::NcmState;
use crate::use_case::ncm::NcmUseCase;

#[tauri::command]
pub(crate) async fn ncm_banner(
    app_handle: AppHandle,
    state: State<'_, NcmState>,
    banner_type: Option<i64>,
) -> Result<Vec<Banner>> {
    NcmUseCase::banner(&app_handle, &state, banner_type).await
}

#[tauri::command]
pub(crate) async fn ncm_recommend_songs(
    app_handle: AppHandle,
    state: State<'_, NcmState>,
) -> Result<Vec<Song>> {
    NcmUseCase::recommend_songs(&app_handle, &state).await
}

#[tauri::command]
pub(crate) async fn ncm_personal_fm(
    app_handle: AppHandle,
    state: State<'_, NcmState>,
) -> Result<Vec<Song>> {
    NcmUseCase::personal_fm(&app_handle, &state).await
}

#[tauri::command]
pub(crate) async fn ncm_fm_trash(
    app_handle: AppHandle,
    state: State<'_, NcmState>,
    id: i64,
) -> Result<()> {
    NcmUseCase::fm_trash(&app_handle, &state, id).await
}

#[tauri::command]
pub(crate) async fn ncm_homepage_dragon_ball(
    app_handle: AppHandle,
    state: State<'_, NcmState>,
) -> Result<Vec<DragonBallItem>> {
    NcmUseCase::dragon_ball(&app_handle, &state).await
}

#[tauri::command]
pub(crate) async fn ncm_playmode_intelligence_list(
    app_handle: AppHandle,
    state: State<'_, NcmState>,
    id: i64,
    pid: i64,
    count: Option<i64>,
) -> Result<Vec<IntelligenceSong>> {
    NcmUseCase::playmode_intelligence_list(&app_handle, &state, id, pid, count).await
}
