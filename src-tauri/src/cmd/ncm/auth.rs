//! NCM 鉴权 IPC 命令（薄壳）：参数透传 → service。

use tauri::{AppHandle, State};

use crate::music::netease::entity::{AuthSession, LoginStatus, QrCheck, QrCreate, QrKey};
use crate::music::netease::error::Result;
use crate::music::netease::NcmState;
use crate::music::service::NcmService;

#[tauri::command]
pub(crate) async fn ncm_login_cellphone(
    app_handle: AppHandle,
    state: State<'_, NcmState>,
    phone: String,
    password: Option<String>,
    captcha: Option<String>,
    countrycode: Option<String>,
) -> Result<AuthSession> {
    NcmService::login_cellphone(&app_handle, &state, phone, password, captcha, countrycode).await
}

#[tauri::command]
pub(crate) async fn ncm_captcha_sent(
    app_handle: AppHandle,
    state: State<'_, NcmState>,
    phone: String,
) -> Result<()> {
    NcmService::captcha_sent(&app_handle, &state, phone).await
}

#[tauri::command]
pub(crate) async fn ncm_captcha_verify(
    app_handle: AppHandle,
    state: State<'_, NcmState>,
    phone: String,
    captcha: String,
) -> Result<()> {
    NcmService::captcha_verify(&app_handle, &state, phone, captcha).await
}

#[tauri::command]
pub(crate) async fn ncm_login_qr_key(
    app_handle: AppHandle,
    state: State<'_, NcmState>,
) -> Result<QrKey> {
    NcmService::login_qr_key(&app_handle, &state).await
}

#[tauri::command]
pub(crate) async fn ncm_login_qr_create(
    app_handle: AppHandle,
    state: State<'_, NcmState>,
    key: String,
    qrimg: Option<String>,
) -> Result<QrCreate> {
    NcmService::login_qr_create(&app_handle, &state, key, qrimg).await
}

#[tauri::command]
pub(crate) async fn ncm_login_qr_check(
    app_handle: AppHandle,
    state: State<'_, NcmState>,
    key: String,
) -> Result<QrCheck> {
    NcmService::login_qr_check(&app_handle, &state, key).await
}

#[tauri::command]
pub(crate) async fn ncm_login_status(
    app_handle: AppHandle,
    state: State<'_, NcmState>,
) -> Result<LoginStatus> {
    NcmService::login_status(&app_handle, &state).await
}

#[tauri::command]
pub(crate) async fn ncm_set_cookie(
    app_handle: AppHandle,
    state: State<'_, NcmState>,
    cookie: String,
) -> Result<()> {
    NcmService::set_cookie(&state, &app_handle, cookie);
    Ok(())
}

#[tauri::command]
pub(crate) async fn ncm_get_cookie(state: State<'_, NcmState>) -> Result<String> {
    Ok(NcmService::get_cookie(&state))
}

#[tauri::command]
pub(crate) async fn ncm_clear_cookie(
    app_handle: AppHandle,
    state: State<'_, NcmState>,
) -> Result<()> {
    NcmService::clear_cookie(&state, &app_handle);
    Ok(())
}
