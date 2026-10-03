//! 网络层错误：`ncm_api_rs` 的失败语义 → 本层词汇表。
//!
//! 本层只回答「这次请求怎么失败的」，不产出面向用户的业务文案，也不感知业务 code：
//! - **HTTP 状态语义**（301 未登录 / 400 参数 / 503 限流）是协议知识，在这里归一
//! - **响应体内的业务 code**（`code != 200/201`）由 `crate::model::error::check_code` 处理
//!
//! `NetError` 只分三类，正好对应 IPC 上真实存在的三个 `kind` 标签。
//! 每类都带两个字段：
//! - `message`：面向用户，短、可执行（前端直接 toast）
//! - `detail`：面向开发者，原始错误 + 根因链 + 标志位（前端只打印到 devtools，不进 UI）

/// 传输层失败分类。
#[derive(Debug)]
pub enum NetError {
    /// HTTP 请求失败 / 超时
    Network {
        message: String,
        detail: Option<String>,
    },
    /// 远端以非 200 作答（未登录、参数错误、风控限流、业务 code 错误等）
    Api {
        message: String,
        detail: Option<String>,
    },
    /// 响应 JSON 与预期结构不匹配
    Decode {
        message: String,
        detail: Option<String>,
    },
}

impl std::fmt::Display for NetError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            NetError::Network { message, .. } => write!(f, "{message}"),
            NetError::Api { message, .. } => write!(f, "{message}"),
            NetError::Decode { message, .. } => write!(f, "数据解析失败：{message}"),
        }
    }
}

impl std::error::Error for NetError {}

pub type Result<T> = std::result::Result<T, NetError>;

/// crate 在响应体没有 `msg` 时填的字面量 —— 视同空串，不能当成用户文案。
const UNKNOWN_MSG: &str = "Unknown error";

/// `msg` 是否「没有可用文案」。
fn is_blank_msg(msg: &str) -> bool {
    msg.trim().is_empty() || msg == UNKNOWN_MSG
}

/// 把 ncm-api-rs 的传输/远端错误归一为本层错误。
///
/// `ncm_api_rs` 对所有非 200 HTTP 状态返回 [`ncm_api_rs::NcmError::from_api`] 的结果
/// （301→`AuthRequired`、400→`InvalidParam`、503→`RateLimited`、其余→`Api`），
/// 这里把它们统一折叠成 [`NetError::Api`]，并逐类补上兜底文案。
///
/// `detail` 一律带上 crate 的原始 Display（含变体名与 code），排查时比归一后的文案信息更多。
pub fn from_ncm(err: ncm_api_rs::NcmError) -> NetError {
    use ncm_api_rs::NcmError as E;
    let raw = err.to_string();
    match err {
        // reqwest 的 Display 只有笼统的 `error sending request for url (...)`，
        // 真正原因要靠 is_timeout/is_connect/source() 链挖出来。
        E::Http(e) => NetError::Network {
            message: format!("网络错误：{}", transport_reason(&e)),
            detail: Some(transport_detail(&e, &raw)),
        },
        E::Timeout(m) => NetError::Network {
            message: if is_blank_msg(&m) {
                "请求超时".to_string()
            } else {
                m
            },
            detail: Some(raw),
        },
        E::Api { code, msg } => NetError::Api {
            message: if is_blank_msg(&msg) {
                format!("请求失败 ({code})")
            } else {
                msg
            },
            detail: Some(raw),
        },
        E::AuthRequired(m) => NetError::Api {
            message: if is_blank_msg(&m) {
                "需要登录".to_string()
            } else {
                m
            },
            detail: Some(raw),
        },
        E::RateLimited(m) => NetError::Api {
            message: if is_blank_msg(&m) {
                "请求过于频繁，请稍后再试".to_string()
            } else {
                m
            },
            detail: Some(raw),
        },
        E::InvalidParam(m) => NetError::Api {
            message: if is_blank_msg(&m) {
                "请求参数不合法".to_string()
            } else {
                m
            },
            detail: Some(raw),
        },
        E::Crypto(m) => NetError::Api {
            message: format!("加密错误：{m}"),
            detail: Some(raw),
        },
        E::Json(e) => NetError::Decode {
            message: e.to_string(),
            detail: Some(raw),
        },
        E::Unknown(m) => NetError::Api {
            message: if is_blank_msg(&m) {
                "请求失败，请重试".to_string()
            } else {
                m
            },
            detail: Some(raw),
        },
    }
}

/// 把 reqwest 的传输错误归类成可读文案。
fn transport_reason(err: &reqwest::Error) -> &'static str {
    if err.is_timeout() {
        "请求超时"
    } else if err.is_connect() {
        "无法连接服务器，请检查网络"
    } else if err.is_body() || err.is_decode() {
        "响应读取失败，请重试"
    } else if err.is_redirect() {
        "重定向失败"
    } else if err.is_request() {
        "请求发送失败"
    } else {
        "请求失败"
    }
}

/// 开发者详情：reqwest 原文 + 最深层根因（DNS / TCP / TLS）+ 标志位。
fn transport_detail(err: &reqwest::Error, raw: &str) -> String {
    let mut parts = vec![raw.to_string()];
    if let Some(root) = root_cause(err) {
        parts.push(format!("根因：{root}"));
    }
    parts.push(format!(
        "flags[timeout={} connect={} request={} body={} decode={} redirect={}]",
        err.is_timeout(),
        err.is_connect(),
        err.is_request(),
        err.is_body(),
        err.is_decode(),
        err.is_redirect(),
    ));
    parts.join(" | ")
}

/// 沿 `source()` 链取最深层原因（reqwest → hyper → io 的最后一环，
/// 通常就是 `dns error: ...` / `Connection refused` 这类真正的原因）。
fn root_cause(err: &reqwest::Error) -> Option<String> {
    use std::error::Error as _;
    let mut cur: Option<&(dyn std::error::Error + 'static)> = err.source();
    let mut last: Option<String> = None;
    while let Some(e) = cur {
        last = Some(e.to_string());
        cur = e.source();
    }
    last
}

#[cfg(test)]
mod tests {
    use super::*;
    use ncm_api_rs::NcmError as E;

    /// 取归一后 Api 错误的「文案 + 开发者详情」。
    fn api_parts(err: NetError) -> (String, String) {
        match err {
            NetError::Api { message, detail } => (message, detail.expect("api 错误必须带 detail")),
            other => panic!("期望 Api，得到 {other:?}"),
        }
    }

    #[test]
    fn keeps_business_message_and_raw_code_in_detail() {
        let (message, detail) = api_parts(from_ncm(E::Api {
            code: -460,
            msg: "网络太频繁，请稍后再试".to_string(),
        }));
        assert_eq!(message, "网络太频繁，请稍后再试");
        assert!(detail.contains("code=-460"), "detail={detail}");
    }

    #[test]
    fn unknown_error_literal_is_not_used_as_message() {
        let (message, detail) = api_parts(from_ncm(E::Api {
            code: -462,
            msg: UNKNOWN_MSG.to_string(),
        }));
        assert_eq!(message, "请求失败 (-462)");
        assert!(detail.contains(UNKNOWN_MSG));
    }

    #[test]
    fn empty_messages_fall_back_per_variant() {
        let empty = || String::new();
        assert_eq!(api_parts(from_ncm(E::AuthRequired(empty()))).0, "需要登录");
        assert_eq!(
            api_parts(from_ncm(E::RateLimited(empty()))).0,
            "请求过于频繁，请稍后再试"
        );
        assert_eq!(
            api_parts(from_ncm(E::InvalidParam(empty()))).0,
            "请求参数不合法"
        );
        assert_eq!(
            api_parts(from_ncm(E::Unknown(empty()))).0,
            "请求失败，请重试"
        );
    }

    #[test]
    fn display_only_exposes_user_facing_message() {
        let err = from_ncm(E::RateLimited("请求过于频繁".to_string()));
        assert_eq!(err.to_string(), "请求过于频繁");
    }
}
