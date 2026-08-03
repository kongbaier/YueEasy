use ncm_api_rs::Query;
use serde_json::Value;
use tauri::{AppHandle, State};

use crate::api::ncm::client::{self, run};
use crate::api::ncm::NcmState;

#[tauri::command]
pub async fn ncm_comment_playlist(
    app_handle: AppHandle,
    state: State<'_, NcmState>,
    id: i64,
    limit: Option<i64>,
    offset: Option<i64>,
) -> Result<Value, String> {
    let mut q = Query::new().param("id", &id.to_string());
    q = client::opt(q, "limit", limit.map(|v| v.to_string()).as_deref());
    q = client::opt(q, "offset", offset.map(|v| v.to_string()).as_deref());
    run(
        &state,
        &app_handle,
        q,
        |c, q| async move { c.comment_playlist(&q).await },
    )
    .await
}

#[tauri::command]
pub async fn ncm_comment_music(
    app_handle: AppHandle,
    state: State<'_, NcmState>,
    id: i64,
    limit: Option<i64>,
    offset: Option<i64>,
) -> Result<Value, String> {
    let mut q = Query::new().param("id", &id.to_string());
    q = client::opt(q, "limit", limit.map(|v| v.to_string()).as_deref());
    q = client::opt(q, "offset", offset.map(|v| v.to_string()).as_deref());
    run(
        &state,
        &app_handle,
        q,
        |c, q| async move { c.comment_music(&q).await },
    )
    .await
}
