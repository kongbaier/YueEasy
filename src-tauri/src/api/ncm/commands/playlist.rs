use ncm_api_rs::Query;
use serde_json::Value;
use tauri::{AppHandle, State};

use crate::api::ncm::client::{self, run};
use crate::api::ncm::NcmState;

#[tauri::command]
pub async fn ncm_playlist_detail(
    app_handle: AppHandle,
    state: State<'_, NcmState>,
    id: i64,
) -> Result<Value, String> {
    run(
        &state,
        &app_handle,
        Query::new().param("id", &id.to_string()),
        |c, q| async move { c.playlist_detail(&q).await },
    )
    .await
}

#[tauri::command]
pub async fn ncm_user_playlist(
    app_handle: AppHandle,
    state: State<'_, NcmState>,
    uid: i64,
) -> Result<Value, String> {
    run(
        &state,
        &app_handle,
        Query::new().param("uid", &uid.to_string()),
        |c, q| async move { c.user_playlist(&q).await },
    )
    .await
}

#[tauri::command]
pub async fn ncm_personalized(
    app_handle: AppHandle,
    state: State<'_, NcmState>,
    limit: Option<i64>,
) -> Result<Value, String> {
    let mut q = Query::new();
    q = client::opt(q, "limit", limit.map(|v| v.to_string()).as_deref());
    run(
        &state,
        &app_handle,
        q,
        |c, q| async move { c.personalized(&q).await },
    )
    .await
}

#[tauri::command]
pub async fn ncm_top_playlist(
    app_handle: AppHandle,
    state: State<'_, NcmState>,
    cat: Option<String>,
    limit: Option<i64>,
    offset: Option<i64>,
) -> Result<Value, String> {
    let mut q = Query::new();
    q = client::opt(q, "cat", cat.as_deref());
    q = client::opt(q, "limit", limit.map(|v| v.to_string()).as_deref());
    q = client::opt(q, "offset", offset.map(|v| v.to_string()).as_deref());
    run(
        &state,
        &app_handle,
        q,
        |c, q| async move { c.top_playlist(&q).await },
    )
    .await
}

#[tauri::command]
pub async fn ncm_playlist_hot(
    app_handle: AppHandle,
    state: State<'_, NcmState>,
) -> Result<Value, String> {
    run(
        &state,
        &app_handle,
        Query::new(),
        |c, q| async move { c.playlist_hot(&q).await },
    )
    .await
}

#[tauri::command]
pub async fn ncm_recommend_resource(
    app_handle: AppHandle,
    state: State<'_, NcmState>,
) -> Result<Value, String> {
    run(
        &state,
        &app_handle,
        Query::new(),
        |c, q| async move { c.recommend_resource(&q).await },
    )
    .await
}
