//! NCM 适配层统一错误。
//!
//! 原则：业务 code / HTTP 错误在 Rust 侧消化，命令只返回 `Result<Entity, NcmApiError>`；
//! 前端只需 catch 并展示 `message`，绝不判断业务 code。

use serde::Serialize;

/// 跨 IPC 序列化为 `{ "kind": ..., "message": ... }`（tagged enum）。
#[derive(Debug, Serialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum NcmApiError {
    /// 网络 / 超时等传输层错误
    Network { message: String },
    /// 业务失败（code 不在白名单，或响应语义失败如验证码发送失败）
    Api { message: String },
    /// 响应结构与 DTO 不匹配
    Decode { message: String },
}

impl std::fmt::Display for NcmApiError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            NcmApiError::Network { message } => write!(f, "{message}"),
            NcmApiError::Api { message } => write!(f, "{message}"),
            NcmApiError::Decode { message } => write!(f, "数据解析失败：{message}"),
        }
    }
}

impl std::error::Error for NcmApiError {}

pub type Result<T> = std::result::Result<T, NcmApiError>;

/// 校验业务 code：白名单成功码（200/201），其余转为 `Api` 错误。
/// 部分接口不返回顶层 code（如歌词、登录状态），视为成功。
pub fn check_code(code: Option<i64>, message: Option<&str>) -> Result<()> {
    match code {
        None => Ok(()),
        Some(200 | 201) => Ok(()),
        Some(c) => {
            let message = message
                .filter(|m| !m.trim().is_empty())
                .map(|m| m.to_string())
                .unwrap_or_else(|| format!("请求失败 ({c})"));
            Err(NcmApiError::Api { message })
        }
    }
}

/// 将 ncm-api-rs 的传输/业务错误转换为适配层错误。
pub fn from_ncm(err: ncm_api_rs::NcmError) -> NcmApiError {
    use ncm_api_rs::NcmError as E;
    match err {
        E::Http(e) => NcmApiError::Network {
            message: format!("网络错误：{e}"),
        },
        E::Timeout(m) => NcmApiError::Network {
            message: if m.is_empty() {
                "请求超时".to_string()
            } else {
                m
            },
        },
        E::Api { code, msg } => NcmApiError::Api {
            message: if msg.is_empty() {
                format!("请求失败 ({code})")
            } else {
                msg
            },
        },
        E::AuthRequired(m) => NcmApiError::Api {
            message: if m.is_empty() {
                "需要登录".to_string()
            } else {
                m
            },
        },
        E::RateLimited(m) => NcmApiError::Api {
            message: if m.is_empty() {
                "请求过于频繁，请稍后再试".to_string()
            } else {
                m
            },
        },
        E::InvalidParam(m) => NcmApiError::Api { message: m },
        E::Crypto(m) => NcmApiError::Api {
            message: format!("加密错误：{m}"),
        },
        E::Json(e) => NcmApiError::Decode {
            message: e.to_string(),
        },
        E::Unknown(m) => NcmApiError::Api { message: m },
    }
}
