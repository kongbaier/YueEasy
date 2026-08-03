use ncm_api_rs::Query;
use serde_json::Value;
use tauri::{AppHandle, State};

use crate::api::ncm::client::{self, run};
use crate::api::ncm::NcmState;

#[tauri::command]
pub async fn ncm_album(
    app_handle: AppHandle,
    state: State<'_, NcmState>,
    id: i64,
) -> Result<Value, String> {
    run(
        &state,
        &app_handle,
        Query::new().param("id", &id.to_string()),
        |c, q| async move { c.album(&q).await },
    )
    .await
}

#[tauri::command]
pub async fn ncm_song_url_v1(
    app_handle: AppHandle,
    state: State<'_, NcmState>,
    id: i64,
    level: Option<String>,
) -> Result<Value, String> {
    let mut q = Query::new().param("id", &id.to_string());
    q = client::opt(q, "level", level.as_deref());
    run(
        &state,
        &app_handle,
        q,
        |c, q| async move { c.song_url_v1(&q).await },
    )
    .await
}

#[tauri::command]
pub async fn ncm_song_detail(
    app_handle: AppHandle,
    state: State<'_, NcmState>,
    ids: Vec<i64>,
) -> Result<Value, String> {
    let joined = ids
        .iter()
        .map(|v| v.to_string())
        .collect::<Vec<_>>()
        .join(",");
    run(
        &state,
        &app_handle,
        Query::new().param("ids", &joined),
        |c, q| async move { c.song_detail(&q).await },
    )
    .await
}

#[tauri::command]
pub async fn ncm_lyric(
    app_handle: AppHandle,
    state: State<'_, NcmState>,
    id: i64,
) -> Result<Value, String> {
    run(
        &state,
        &app_handle,
        Query::new().param("id", &id.to_string()),
        |c, q| async move { c.lyric(&q).await },
    )
    .await
}

#[tauri::command]
pub async fn ncm_lyric_new(
    app_handle: AppHandle,
    state: State<'_, NcmState>,
    id: i64,
) -> Result<Value, String> {
    run(
        &state,
        &app_handle,
        Query::new().param("id", &id.to_string()),
        |c, q| async move { c.lyric_new(&q).await },
    )
    .await
}

#[tauri::command]
pub async fn ncm_like(
    app_handle: AppHandle,
    state: State<'_, NcmState>,
    id: i64,
    like: Option<bool>,
) -> Result<Value, String> {
    let mut q = Query::new().param("id", &id.to_string());
    q = client::opt(q, "like", like.map(|v| v.to_string()).as_deref());
    run(
        &state,
        &app_handle,
        q,
        |c, q| async move { c.like(&q).await },
    )
    .await
}

#[tauri::command]
pub async fn ncm_likelist(
    app_handle: AppHandle,
    state: State<'_, NcmState>,
    uid: i64,
) -> Result<Value, String> {
    run(
        &state,
        &app_handle,
        Query::new().param("uid", &uid.to_string()),
        |c, q| async move { c.likelist(&q).await },
    )
    .await
}

#[tauri::command]
pub async fn ncm_record_recent_song(
    app_handle: AppHandle,
    state: State<'_, NcmState>,
    uid: i64,
) -> Result<Value, String> {
    run(
        &state,
        &app_handle,
        Query::new().param("uid", &uid.to_string()),
        |c, q| async move { c.record_recent_song(&q).await },
    )
    .await
}
