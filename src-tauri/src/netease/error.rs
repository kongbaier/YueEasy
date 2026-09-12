//! 网络层错误：`ncm_api_rs` 的失败语义 → 本层词汇表。
//!
//! 本层只回答「这次请求怎么失败的」，不产出面向用户的业务文案，也不感知业务 code：
//! - **HTTP 状态语义**（301 未登录 / 400 参数 / 503 限流）是协议知识，在这里归一
//! - **响应体内的业务 code**（`code != 200/201`）由 `crate::model::error::check_code` 处理
//!
//! `NetError` 只分三类，正好对应 IPC 上真实存在的三个 `kind` 标签。

/// 传输层失败分类。
#[derive(Debug)]
pub enum NetError {
    /// HTTP 请求失败 / 超时
    Network { message: String },
    /// 远端以非 200 作答（未登录、参数错误、风控限流、业务 code 错误等）
    Api { message: String },
    /// 响应 JSON 与预期结构不匹配
    Decode { message: String },
}

impl std::fmt::Display for NetError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            NetError::Network { message } => write!(f, "{message}"),
            NetError::Api { message } => write!(f, "{message}"),
            NetError::Decode { message } => write!(f, "数据解析失败：{message}"),
        }
    }
}

impl std::error::Error for NetError {}

pub type Result<T> = std::result::Result<T, NetError>;

/// 将 ncm-api-rs 的传输/远端错误归一为本层错误。
///
/// `ncm_api_rs` 对所有非 200 HTTP 状态返回 [`ncm_api_rs::NcmError::from_api`] 的结果
/// （301→`AuthRequired`、400→`InvalidParam`、503→`RateLimited`、其余→`Api`），
/// 这里把它们统一折叠成 [`NetError::Api`]，并逐类补上兜底文案。
pub fn from_ncm(err: ncm_api_rs::NcmError) -> NetError {
    use ncm_api_rs::NcmError as E;
    match err {
        E::Http(e) => NetError::Network {
            message: format!("网络错误：{e}"),
        },
        E::Timeout(m) => NetError::Network {
            message: if m.is_empty() {
                "请求超时".to_string()
            } else {
                m
            },
        },
        E::Api { code, msg } => NetError::Api {
            message: if msg.is_empty() {
                format!("请求失败 ({code})")
            } else {
                msg
            },
        },
        E::AuthRequired(m) => NetError::Api {
            message: if m.is_empty() {
                "需要登录".to_string()
            } else {
                m
            },
        },
        E::RateLimited(m) => NetError::Api {
            message: if m.is_empty() {
                "请求过于频繁，请稍后再试".to_string()
            } else {
                m
            },
        },
        E::InvalidParam(m) => NetError::Api { message: m },
        E::Crypto(m) => NetError::Api {
            message: format!("加密错误：{m}"),
        },
        E::Json(e) => NetError::Decode {
            message: e.to_string(),
        },
        E::Unknown(m) => NetError::Api { message: m },
    }
}
