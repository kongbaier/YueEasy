use ncm_api_rs::Query;
use serde_json::Value;
use tauri::{AppHandle, State};

use crate::api::ncm::client::{self, run};
use crate::api::ncm::NcmState;

#[tauri::command]
pub async fn ncm_banner(
    app_handle: AppHandle,
    state: State<'_, NcmState>,
    banner_type: Option<i64>,
) -> Result<Value, String> {
    let mut q = Query::new();
    q = client::opt(q, "type", banner_type.map(|v| v.to_string()).as_deref());
    run(
        &state,
        &app_handle,
        q,
        |c, q| async move { c.banner(&q).await },
    )
    .await
}

#[tauri::command]
pub async fn ncm_recommend_songs(
    app_handle: AppHandle,
    state: State<'_, NcmState>,
) -> Result<Value, String> {
    run(
        &state,
        &app_handle,
        Query::new(),
        |c, q| async move { c.recommend_songs(&q).await },
    )
    .await
}

#[tauri::command]
pub async fn ncm_personal_fm(
    app_handle: AppHandle,
    state: State<'_, NcmState>,
) -> Result<Value, String> {
    run(
        &state,
        &app_handle,
        Query::new(),
        |c, q| async move { c.personal_fm(&q).await },
    )
    .await
}

#[tauri::command]
pub async fn ncm_fm_trash(
    app_handle: AppHandle,
    state: State<'_, NcmState>,
    id: i64,
) -> Result<Value, String> {
    run(
        &state,
        &app_handle,
        Query::new().param("id", &id.to_string()),
        |c, q| async move { c.fm_trash(&q).await },
    )
    .await
}

#[tauri::command]
pub async fn ncm_homepage_dragon_ball(
    app_handle: AppHandle,
    state: State<'_, NcmState>,
) -> Result<Value, String> {
    run(
        &state,
        &app_handle,
        Query::new(),
        |c, q| async move { c.homepage_dragon_ball(&q).await },
    )
    .await
}

#[tauri::command]
pub async fn ncm_playmode_intelligence_list(
    app_handle: AppHandle,
    state: State<'_, NcmState>,
    id: i64,
    pid: i64,
    count: Option<i64>,
) -> Result<Value, String> {
    let mut q = Query::new()
        .param("id", &id.to_string())
        .param("pid", &pid.to_string());
    q = client::opt(q, "count", count.map(|v| v.to_string()).as_deref());
    run(
        &state,
        &app_handle,
        q,
        |c, q| async move { c.playmode_intelligence_list(&q).await },
    )
    .await
}
