//! NCM 歌单 IPC 命令（薄壳）：参数透传 → use_case。

use tauri::{AppHandle, State};

use crate::infra::ncm::entity::{Playlist, PlaylistHotTag, PlaylistPage};
use crate::infra::ncm::error::Result;
use crate::infra::ncm::NcmState;
use crate::use_case::ncm::NcmUseCase;

#[tauri::command]
pub(crate) async fn ncm_playlist_detail(
    app_handle: AppHandle,
    state: State<'_, NcmState>,
    id: i64,
) -> Result<Playlist> {
    NcmUseCase::playlist_detail(&app_handle, &state, id).await
}

#[tauri::command]
pub(crate) async fn ncm_user_playlist(
    app_handle: AppHandle,
    state: State<'_, NcmState>,
    uid: i64,
) -> Result<Vec<Playlist>> {
    NcmUseCase::user_playlist(&app_handle, &state, uid).await
}

#[tauri::command]
pub(crate) async fn ncm_personalized(
    app_handle: AppHandle,
    state: State<'_, NcmState>,
    limit: Option<i64>,
) -> Result<Vec<Playlist>> {
    NcmUseCase::personalized(&app_handle, &state, limit).await
}

#[tauri::command]
pub(crate) async fn ncm_top_playlist(
    app_handle: AppHandle,
    state: State<'_, NcmState>,
    cat: Option<String>,
    limit: Option<i64>,
    offset: Option<i64>,
) -> Result<PlaylistPage> {
    NcmUseCase::top_playlist(&app_handle, &state, cat, limit, offset).await
}

#[tauri::command]
pub(crate) async fn ncm_playlist_hot(
    app_handle: AppHandle,
    state: State<'_, NcmState>,
) -> Result<Vec<PlaylistHotTag>> {
    NcmUseCase::playlist_hot(&app_handle, &state).await
}

#[tauri::command]
pub(crate) async fn ncm_recommend_resource(
    app_handle: AppHandle,
    state: State<'_, NcmState>,
) -> Result<Vec<Playlist>> {
    NcmUseCase::recommend_resource(&app_handle, &state).await
}
