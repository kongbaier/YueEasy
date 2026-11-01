//! NCM 鉴权 IPC 命令（薄壳）：参数透传 → service。

use tauri::State;

use super::command;
use crate::model::entity::{AuthSession, LoginStatus, QrCheck, QrCreate, QrKey};
use crate::model::error::Result;
use crate::netease::NcmState;
use crate::service::NcmService;

command!(ncm_login_cellphone(state, phone: String, password: Option<String>, captcha: Option<String>, countrycode: Option<String>) -> AuthSession => login_cellphone);
command!(ncm_captcha_sent(state, phone: String) => captcha_sent);
command!(ncm_captcha_verify(state, phone: String, captcha: String) => captcha_verify);
command!(ncm_login_qr_key(state) -> QrKey => login_qr_key);
command!(ncm_login_qr_create(state, key: String, qrimg: Option<String>) -> QrCreate => login_qr_create);
command!(ncm_login_qr_check(state, key: String) -> QrCheck => login_qr_check);
command!(ncm_login_status(state) -> LoginStatus => login_status);

// cookie 维护是同步、永不失败的本地操作，不值得套请求薄壳宏（那会伪装成一次请求）。
#[tauri::command]
pub(crate) async fn ncm_set_cookie(state: State<'_, NcmState>, cookie: String) -> Result<()> {
    NcmService::set_cookie(&state, cookie);
    Ok(())
}

#[tauri::command]
pub(crate) async fn ncm_get_cookie(state: State<'_, NcmState>) -> Result<String> {
    Ok(NcmService::get_cookie(&state))
}

#[tauri::command]
pub(crate) async fn ncm_clear_cookie(state: State<'_, NcmState>) -> Result<()> {
    NcmService::clear_cookie(&state);
    Ok(())
}
