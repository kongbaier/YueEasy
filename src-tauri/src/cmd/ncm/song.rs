//! NCM 歌曲/专辑 IPC 命令（薄壳）：参数透传 → use_case。

use tauri::{AppHandle, State};

use crate::infra::ncm::entity::{AlbumDetail, LikeList, Lyric, RecentSongs, Song, SongUrlResult};
use crate::infra::ncm::error::Result;
use crate::infra::ncm::NcmState;
use crate::use_case::ncm::NcmUseCase;

#[tauri::command]
pub(crate) async fn ncm_album(
    app_handle: AppHandle,
    state: State<'_, NcmState>,
    id: i64,
) -> Result<AlbumDetail> {
    NcmUseCase::album(&app_handle, &state, id).await
}

#[tauri::command]
pub(crate) async fn ncm_song_url_v1(
    app_handle: AppHandle,
    state: State<'_, NcmState>,
    id: i64,
    level: Option<String>,
) -> Result<SongUrlResult> {
    NcmUseCase::song_url(&app_handle, &state, id, level).await
}

#[tauri::command]
pub(crate) async fn ncm_song_detail(
    app_handle: AppHandle,
    state: State<'_, NcmState>,
    ids: Vec<i64>,
) -> Result<Vec<Song>> {
    NcmUseCase::song_detail(&app_handle, &state, ids).await
}

#[tauri::command]
pub(crate) async fn ncm_lyric(
    app_handle: AppHandle,
    state: State<'_, NcmState>,
    id: i64,
) -> Result<Lyric> {
    NcmUseCase::lyric(&app_handle, &state, id).await
}

#[tauri::command]
pub(crate) async fn ncm_lyric_new(
    app_handle: AppHandle,
    state: State<'_, NcmState>,
    id: i64,
) -> Result<Lyric> {
    NcmUseCase::lyric_new(&app_handle, &state, id).await
}

#[tauri::command]
pub(crate) async fn ncm_like(
    app_handle: AppHandle,
    state: State<'_, NcmState>,
    id: i64,
    like: Option<bool>,
) -> Result<()> {
    NcmUseCase::like(&app_handle, &state, id, like).await
}

#[tauri::command]
pub(crate) async fn ncm_likelist(
    app_handle: AppHandle,
    state: State<'_, NcmState>,
    uid: i64,
) -> Result<LikeList> {
    NcmUseCase::like_list(&app_handle, &state, uid).await
}

#[tauri::command]
pub(crate) async fn ncm_record_recent_song(
    app_handle: AppHandle,
    state: State<'_, NcmState>,
    uid: i64,
) -> Result<RecentSongs> {
    NcmUseCase::recent_song(&app_handle, &state, uid).await
}
