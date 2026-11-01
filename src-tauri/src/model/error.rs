//! 数据处理层的错误：业务 code 校验 + 对 IPC 暴露的错误形状。
//!
//! 与 [`crate::netease::error::NetError`] 的分工：
//! - `NetError` 描述「请求怎么失败的」（HTTP 状态 / 超时 / 解码），文案由网络层给出
//! - 本模块描述「响应内容是否被业务接受」（`code != 200/201`），并持有对外 wire 形状
//!
//! 两者经 [`From`] 无损对接：`NetError` 的三类恰好对应 `NcmApiError` 的三类。
//!
//! 原则：业务 code 在 Rust 侧消化，命令只返回 `Result<Entity, NcmApiError>`；
//! 前端只需 catch 并展示 `message`，绝不判断业务 code。

use serde::Serialize;

use crate::netease::error::NetError;

/// 跨 IPC 序列化为 `{ "kind": ..., "message": ..., "detail"?: ... }`（tagged enum）。
/// - `message`：面向用户，前端直接展示
/// - `detail`：面向开发者，前端只 `console` 到 devtools（根因链 / 原始 code），不进 UI
#[derive(Debug, Serialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum NcmApiError {
    /// 网络 / 超时等传输层错误
    Network {
        message: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        detail: Option<String>,
    },
    /// 业务失败（code 不在白名单，或响应语义失败如验证码发送失败）
    Api {
        message: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        detail: Option<String>,
    },
    /// 响应结构与 DTO 不匹配
    Decode {
        message: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        detail: Option<String>,
    },
}

impl NcmApiError {
    /// 业务失败（无开发者详情时用）。
    pub fn api(message: impl Into<String>) -> Self {
        Self::Api {
            message: message.into(),
            detail: None,
        }
    }
}

impl std::fmt::Display for NcmApiError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            NcmApiError::Network { message, .. } => write!(f, "{message}"),
            NcmApiError::Api { message, .. } => write!(f, "{message}"),
            NcmApiError::Decode { message, .. } => write!(f, "数据解析失败：{message}"),
        }
    }
}

impl std::error::Error for NcmApiError {}

pub type Result<T> = std::result::Result<T, NcmApiError>;

/// 网络层错误 → 对外错误。三臂全量、无损（含开发者 detail），保证 IPC 上的 `kind` 与文案不变。
impl From<NetError> for NcmApiError {
    fn from(err: NetError) -> Self {
        match err {
            NetError::Network { message, detail } => NcmApiError::Network { message, detail },
            NetError::Api { message, detail } => NcmApiError::Api { message, detail },
            NetError::Decode { message, detail } => NcmApiError::Decode { message, detail },
        }
    }
}

/// 取出响应里的必填字段：缺字段是 `Decode` 错误（结构不符），不是业务失败。
///
/// 统一在这里构造，避免每个调用点各写一份 `ok_or_else(|| NcmApiError::decode(..))`
/// 导致文案与 `detail` 五花八门：
///
/// ```ignore
/// let playlist = required(dto.playlist, "playlist")?;
/// ```
pub fn required<T>(value: Option<T>, field: &'static str) -> Result<T> {
    value.ok_or_else(|| NcmApiError::Decode {
        message: format!("响应缺少 {field} 字段"),
        detail: Some(format!("expected non-null `{field}` in response body")),
    })
}

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
            Err(NcmApiError::Api {
                message,
                detail: Some(format!("响应体 code={c}")),
            })
        }
    }
}
