//! NCM 鉴权 IPC 命令（薄壳）：参数透传 → use_case。

use tauri::{AppHandle, State};

use crate::infra::ncm::entity::{AuthSession, LoginStatus, QrCheck, QrCreate, QrKey};
use crate::infra::ncm::error::Result;
use crate::infra::ncm::NcmState;
use crate::use_case::ncm::NcmUseCase;

#[tauri::command]
pub(crate) async fn ncm_login_cellphone(
    app_handle: AppHandle,
    state: State<'_, NcmState>,
    phone: String,
    password: Option<String>,
    captcha: Option<String>,
    countrycode: Option<String>,
) -> Result<AuthSession> {
    NcmUseCase::login_cellphone(&app_handle, &state, phone, password, captcha, countrycode).await
}

#[tauri::command]
pub(crate) async fn ncm_captcha_sent(
    app_handle: AppHandle,
    state: State<'_, NcmState>,
    phone: String,
) -> Result<()> {
    NcmUseCase::captcha_sent(&app_handle, &state, phone).await
}

#[tauri::command]
pub(crate) async fn ncm_captcha_verify(
    app_handle: AppHandle,
    state: State<'_, NcmState>,
    phone: String,
    captcha: String,
) -> Result<()> {
    NcmUseCase::captcha_verify(&app_handle, &state, phone, captcha).await
}

#[tauri::command]
pub(crate) async fn ncm_login_qr_key(
    app_handle: AppHandle,
    state: State<'_, NcmState>,
) -> Result<QrKey> {
    NcmUseCase::login_qr_key(&app_handle, &state).await
}

#[tauri::command]
pub(crate) async fn ncm_login_qr_create(
    app_handle: AppHandle,
    state: State<'_, NcmState>,
    key: String,
    qrimg: Option<String>,
) -> Result<QrCreate> {
    NcmUseCase::login_qr_create(&app_handle, &state, key, qrimg).await
}

#[tauri::command]
pub(crate) async fn ncm_login_qr_check(
    app_handle: AppHandle,
    state: State<'_, NcmState>,
    key: String,
) -> Result<QrCheck> {
    NcmUseCase::login_qr_check(&app_handle, &state, key).await
}

#[tauri::command]
pub(crate) async fn ncm_login_status(
    app_handle: AppHandle,
    state: State<'_, NcmState>,
) -> Result<LoginStatus> {
    NcmUseCase::login_status(&app_handle, &state).await
}

#[tauri::command]
pub(crate) async fn ncm_set_cookie(
    app_handle: AppHandle,
    state: State<'_, NcmState>,
    cookie: String,
) -> Result<()> {
    NcmUseCase::set_cookie(&state, &app_handle, cookie);
    Ok(())
}

#[tauri::command]
pub(crate) async fn ncm_get_cookie(state: State<'_, NcmState>) -> Result<String> {
    Ok(NcmUseCase::get_cookie(&state))
}

#[tauri::command]
pub(crate) async fn ncm_clear_cookie(
    app_handle: AppHandle,
    state: State<'_, NcmState>,
) -> Result<()> {
    NcmUseCase::clear_cookie(&state, &app_handle);
    Ok(())
}
