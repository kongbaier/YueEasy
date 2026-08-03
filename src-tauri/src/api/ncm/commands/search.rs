use ncm_api_rs::Query;
use serde_json::Value;
use tauri::{AppHandle, State};

use crate::api::ncm::client::{self, run};
use crate::api::ncm::NcmState;

#[tauri::command]
pub async fn ncm_cloudsearch(
    app_handle: AppHandle,
    state: State<'_, NcmState>,
    keywords: String,
    search_type: Option<i64>, // 1=歌曲 10=专辑 100=歌手 1002=用户
    limit: Option<i64>,
    offset: Option<i64>,
) -> Result<Value, String> {
    let mut q = Query::new().param("keywords", &keywords);
    q = client::opt(q, "type", search_type.map(|v| v.to_string()).as_deref());
    q = client::opt(q, "limit", limit.map(|v| v.to_string()).as_deref());
    q = client::opt(q, "offset", offset.map(|v| v.to_string()).as_deref());
    run(
        &state,
        &app_handle,
        q,
        |c, q| async move { c.cloudsearch(&q).await },
    )
    .await
}

#[tauri::command]
pub async fn ncm_search_suggest(
    app_handle: AppHandle,
    state: State<'_, NcmState>,
    keywords: String,
) -> Result<Value, String> {
    run(
        &state,
        &app_handle,
        Query::new().param("keywords", &keywords),
        |c, q| async move { c.search_suggest(&q).await },
    )
    .await
}

#[tauri::command]
pub async fn ncm_search_hot(
    app_handle: AppHandle,
    state: State<'_, NcmState>,
) -> Result<Value, String> {
    run(
        &state,
        &app_handle,
        Query::new(),
        |c, q| async move { c.search_hot(&q).await },
    )
    .await
}
