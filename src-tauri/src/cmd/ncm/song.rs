//! NCM 歌曲/专辑 IPC 命令（薄壳）：参数透传 → service。

use tauri::{AppHandle, State};

use crate::infra::ncm::entity::{AlbumDetail, LikeList, Lyric, RecentSongs, Song, SongUrlResult};
use crate::infra::ncm::error::Result;
use crate::infra::ncm::NcmState;
use crate::service::ncm_service::NcmService;

#[tauri::command]
pub(crate) async fn ncm_album(
    app_handle: AppHandle,
    state: State<'_, NcmState>,
    id: i64,
) -> Result<AlbumDetail> {
    NcmService::album(&app_handle, &state, id).await
}

#[tauri::command]
pub(crate) async fn ncm_song_url_v1(
    app_handle: AppHandle,
    state: State<'_, NcmState>,
    id: i64,
    level: Option<String>,
) -> Result<SongUrlResult> {
    NcmService::song_url(&app_handle, &state, id, level).await
}

#[tauri::command]
pub(crate) async fn ncm_song_detail(
    app_handle: AppHandle,
    state: State<'_, NcmState>,
    ids: Vec<i64>,
) -> Result<Vec<Song>> {
    NcmService::song_detail(&app_handle, &state, ids).await
}

#[tauri::command]
pub(crate) async fn ncm_lyric(
    app_handle: AppHandle,
    state: State<'_, NcmState>,
    id: i64,
) -> Result<Lyric> {
    NcmService::lyric(&app_handle, &state, id).await
}

#[tauri::command]
pub(crate) async fn ncm_lyric_new(
    app_handle: AppHandle,
    state: State<'_, NcmState>,
    id: i64,
) -> Result<Lyric> {
    NcmService::lyric_new(&app_handle, &state, id).await
}

#[tauri::command]
pub(crate) async fn ncm_like(
    app_handle: AppHandle,
    state: State<'_, NcmState>,
    id: i64,
    like: Option<bool>,
) -> Result<()> {
    NcmService::like(&app_handle, &state, id, like).await
}

#[tauri::command]
pub(crate) async fn ncm_likelist(
    app_handle: AppHandle,
    state: State<'_, NcmState>,
    uid: i64,
) -> Result<LikeList> {
    NcmService::like_list(&app_handle, &state, uid).await
}

#[tauri::command]
pub(crate) async fn ncm_record_recent_song(
    app_handle: AppHandle,
    state: State<'_, NcmState>,
    uid: i64,
) -> Result<RecentSongs> {
    NcmService::recent_song(&app_handle, &state, uid).await
}
