use ncm_api_rs::Query;
use serde_json::Value;
use tauri::{AppHandle, State};

use crate::api::ncm::client::{self, run};
use crate::api::ncm::cookie::persist_cookie;
use crate::api::ncm::NcmState;

#[tauri::command]
pub async fn ncm_login_cellphone(
    app_handle: AppHandle,
    state: State<'_, NcmState>,
    phone: String,
    password: Option<String>,
    captcha: Option<String>,
    countrycode: Option<String>,
) -> Result<Value, String> {
    let mut q = Query::new().param("phone", &phone);
    q = client::opt(q, "password", password.as_deref());
    q = client::opt(q, "captcha", captcha.as_deref());
    q = client::opt(q, "countrycode", countrycode.as_deref());
    run(
        &state,
        &app_handle,
        q,
        |c, q| async move { c.login_cellphone(&q).await },
    )
    .await
}

#[tauri::command]
pub async fn ncm_captcha_sent(
    app_handle: AppHandle,
    state: State<'_, NcmState>,
    phone: String,
) -> Result<Value, String> {
    run(
        &state,
        &app_handle,
        Query::new().param("phone", &phone),
        |c, q| async move { c.captcha_sent(&q).await },
    )
    .await
}

#[tauri::command]
pub async fn ncm_captcha_verify(
    app_handle: AppHandle,
    state: State<'_, NcmState>,
    phone: String,
    captcha: String,
) -> Result<Value, String> {
    run(
        &state,
        &app_handle,
        Query::new()
            .param("phone", &phone)
            .param("captcha", &captcha),
        |c, q| async move { c.captcha_verify(&q).await },
    )
    .await
}

#[tauri::command]
pub async fn ncm_login_qr_key(
    app_handle: AppHandle,
    state: State<'_, NcmState>,
) -> Result<Value, String> {
    run(
        &state,
        &app_handle,
        Query::new(),
        |c, q| async move { c.login_qr_key(&q).await },
    )
    .await
}

#[tauri::command]
pub async fn ncm_login_qr_create(
    app_handle: AppHandle,
    state: State<'_, NcmState>,
    key: String,
    qrimg: Option<String>,
) -> Result<Value, String> {
    let mut q = Query::new().param("key", &key);
    q = client::opt(q, "qrimg", qrimg.as_deref());
    run(
        &state,
        &app_handle,
        q,
        |c, q| async move { c.login_qr_create(&q).await },
    )
    .await
}

#[tauri::command]
pub async fn ncm_login_qr_check(
    app_handle: AppHandle,
    state: State<'_, NcmState>,
    key: String,
) -> Result<Value, String> {
    run(
        &state,
        &app_handle,
        Query::new().param("key", &key),
        |c, q| async move { c.login_qr_check(&q).await },
    )
    .await
}

#[tauri::command]
pub async fn ncm_login_status(
    app_handle: AppHandle,
    state: State<'_, NcmState>,
) -> Result<Value, String> {
    run(
        &state,
        &app_handle,
        Query::new(),
        |c, q| async move { c.login_status(&q).await },
    )
    .await
}

#[tauri::command]
pub async fn ncm_set_cookie(
    app_handle: AppHandle,
    state: State<'_, NcmState>,
    cookie: String,
) -> Result<(), String> {
    state.inner.lock().unwrap().cookie = cookie.clone();
    persist_cookie(&app_handle, &cookie);
    Ok(())
}

#[tauri::command]
pub async fn ncm_get_cookie(state: State<'_, NcmState>) -> Result<String, String> {
    Ok(state.inner.lock().unwrap().cookie.clone())
}

#[tauri::command]
pub async fn ncm_clear_cookie(
    app_handle: AppHandle,
    state: State<'_, NcmState>,
) -> Result<(), String> {
    log::info!("[ncm_clear_cookie] clearing cookie from memory and store");
    state.inner.lock().unwrap().cookie.clear();
    persist_cookie(&app_handle, "");
    Ok(())
}
