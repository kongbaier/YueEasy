//! NCM 搜索 IPC 命令（薄壳）：参数透传 → service。

use tauri::{AppHandle, State};

use crate::music::netease::entity::{HotSearchItem, SearchResult, SuggestResult};
use crate::music::netease::error::Result;
use crate::music::netease::NcmState;
use crate::music::service::NcmService;

#[tauri::command]
pub(crate) async fn ncm_cloudsearch(
    app_handle: AppHandle,
    state: State<'_, NcmState>,
    keywords: String,
    search_type: Option<i64>, // 1=歌曲 10=专辑 100=歌手 1002=用户
    limit: Option<i64>,
    offset: Option<i64>,
) -> Result<SearchResult> {
    NcmService::cloudsearch(&app_handle, &state, keywords, search_type, limit, offset).await
}

#[tauri::command]
pub(crate) async fn ncm_search_suggest(
    app_handle: AppHandle,
    state: State<'_, NcmState>,
    keywords: String,
) -> Result<SuggestResult> {
    NcmService::search_suggest(&app_handle, &state, keywords).await
}

#[tauri::command]
pub(crate) async fn ncm_search_hot(
    app_handle: AppHandle,
    state: State<'_, NcmState>,
) -> Result<Vec<HotSearchItem>> {
    NcmService::search_hot(&app_handle, &state).await
}
