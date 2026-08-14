//! NCM 歌单 IPC 命令（薄壳）：参数透传 → service。

use tauri::{AppHandle, State};

use crate::music::netease::entity::{Playlist, PlaylistHotTag, PlaylistPage};
use crate::music::netease::error::Result;
use crate::music::netease::NcmState;
use crate::music::service::NcmService;

#[tauri::command]
pub(crate) async fn ncm_playlist_detail(
    app_handle: AppHandle,
    state: State<'_, NcmState>,
    id: i64,
) -> Result<Playlist> {
    NcmService::playlist_detail(&app_handle, &state, id).await
}

#[tauri::command]
pub(crate) async fn ncm_user_playlist(
    app_handle: AppHandle,
    state: State<'_, NcmState>,
    uid: i64,
) -> Result<Vec<Playlist>> {
    NcmService::user_playlist(&app_handle, &state, uid).await
}

#[tauri::command]
pub(crate) async fn ncm_personalized(
    app_handle: AppHandle,
    state: State<'_, NcmState>,
    limit: Option<i64>,
) -> Result<Vec<Playlist>> {
    NcmService::personalized(&app_handle, &state, limit).await
}

#[tauri::command]
pub(crate) async fn ncm_top_playlist(
    app_handle: AppHandle,
    state: State<'_, NcmState>,
    cat: Option<String>,
    limit: Option<i64>,
    offset: Option<i64>,
) -> Result<PlaylistPage> {
    NcmService::top_playlist(&app_handle, &state, cat, limit, offset).await
}

#[tauri::command]
pub(crate) async fn ncm_playlist_hot(
    app_handle: AppHandle,
    state: State<'_, NcmState>,
) -> Result<Vec<PlaylistHotTag>> {
    NcmService::playlist_hot(&app_handle, &state).await
}

#[tauri::command]
pub(crate) async fn ncm_recommend_resource(
    app_handle: AppHandle,
    state: State<'_, NcmState>,
) -> Result<Vec<Playlist>> {
    NcmService::recommend_resource(&app_handle, &state).await
}
