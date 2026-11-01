//! 鉴权域：手机号 / 验证码 / 二维码登录、登录态与 cookie 维护。

use ncm_api_rs::Query;

use super::{call, NcmService};
use crate::model::entity::{AuthSession, LoginStatus, QrCheck, QrCreate, QrKey};
use crate::model::error::{NcmApiError, Result};
use crate::model::{mapper, response};
use crate::netease::client::{self, QueryExt};
use crate::netease::NcmState;

impl NcmService {
    pub async fn login_cellphone(
        state: &NcmState,
        phone: String,
        password: Option<String>,
        captcha: Option<String>,
        countrycode: Option<String>,
    ) -> Result<AuthSession> {
        // 验证码与密码是两条互斥路径（上游 Node 同此语义）：给了验证码就走验证码登录，
        // 不能再把 captcha 当 password 发给服务端（见 `client::login_cellphone_by_captcha`）。
        let dto: response::LoginResponseDto = match captcha.filter(|c| !c.trim().is_empty()) {
            Some(captcha) => {
                Self::call(state, Query::new(), |api, _q| async move {
                    client::login_cellphone_by_captcha(
                        &api,
                        &phone,
                        &captcha,
                        countrycode.as_deref(),
                    )
                    .await
                })
                .await?
            }
            None => {
                call!(
                    state,
                    Query::new()
                        .p("phone", &phone)
                        .o("password", password)
                        .o("countrycode", countrycode),
                    login_cellphone
                )
                .await?
            }
        };
        Ok(mapper::map_auth_session(dto))
    }

    pub async fn captcha_sent(state: &NcmState, phone: String) -> Result<()> {
        let dto: response::CaptchaResponseDto =
            call!(state, Query::new().p("phone", &phone), captcha_sent).await?;
        ensure_accepted(dto, "验证码发送失败")
    }

    pub async fn captcha_verify(state: &NcmState, phone: String, captcha: String) -> Result<()> {
        let dto: response::CaptchaResponseDto = call!(
            state,
            Query::new().p("phone", &phone).p("captcha", &captcha),
            captcha_verify
        )
        .await?;
        ensure_accepted(dto, "验证码校验失败")
    }

    pub async fn login_qr_key(state: &NcmState) -> Result<QrKey> {
        let dto: response::QrKeyResponseDto = call!(state, Query::new(), login_qr_key).await?;
        Ok(mapper::map_qr_key(dto))
    }

    pub async fn login_qr_create(
        state: &NcmState,
        key: String,
        qrimg: Option<String>,
    ) -> Result<QrCreate> {
        let dto: response::QrCreateResponseDto = call!(
            state,
            Query::new().p("key", &key).o("qrimg", qrimg),
            login_qr_create
        )
        .await?;
        Ok(mapper::map_qr_create(dto))
    }

    /// qr_check 的 800/801/802/803 是轮询状态而非错误（`QrCheckResponseDto` 不参与 code 校验）。
    pub async fn login_qr_check(state: &NcmState, key: String) -> Result<QrCheck> {
        let dto: response::QrCheckResponseDto =
            call!(state, Query::new().p("key", &key), login_qr_check).await?;
        let qr = mapper::map_qr_check(dto);
        // 803 确认后若响应体携带 cookie（Set-Cookie 响应头缺失时是唯一来源），
        // 把它合并进内存态并持久化，避免重启后丢失登录。
        if let Some(cookie) = qr.cookie.as_deref().filter(|c| !c.is_empty()) {
            state.merge_cookie(&[cookie.to_string()]);
        }
        Ok(qr)
    }

    pub async fn login_status(state: &NcmState) -> Result<LoginStatus> {
        let dto: response::LoginStatusResponseDto =
            call!(state, Query::new(), login_status).await?;
        Ok(mapper::map_login_status(dto))
    }

    pub fn set_cookie(state: &NcmState, cookie: String) {
        state.set_cookie(cookie);
    }

    pub fn get_cookie(state: &NcmState) -> String {
        state.cookie()
    }

    pub fn clear_cookie(state: &NcmState) {
        log::info!("[ncm_clear_cookie] clearing cookie from memory and store");
        state.set_cookie(String::new());
    }
}

/// 验证码接口用 `data == false` 表达语义失败（顶层 code 仍是 200），单独判定。
fn ensure_accepted(dto: response::CaptchaResponseDto, fallback: &str) -> Result<()> {
    if dto.data == Some(false) {
        let message = dto
            .message
            .filter(|m| !m.trim().is_empty())
            .unwrap_or_else(|| fallback.to_string());
        return Err(NcmApiError::api(message));
    }
    Ok(())
}
