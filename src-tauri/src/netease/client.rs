use std::future::Future;
use std::time::Duration;

use ncm_api_rs::{ApiClient, CryptoType, Query, RequestOption};
use serde::de::DeserializeOwned;
use serde_json::{json, Number, Value};

use super::error::{from_ncm, NetError, Result};
use super::NcmState;

/// ncm-api-rs 未在 crate 根导出 `Result`，这里显式别名。
pub(crate) type ApiResult = std::result::Result<ncm_api_rs::ApiResponse, ncm_api_rs::NcmError>;

/// 请求超时。ncm-api-rs 自身不设超时，少了这层会一直挂。
const REQUEST_TIMEOUT: Duration = Duration::from_secs(10);

/// 发一次通知请求并解码为 DTO。
///
/// 调用方自己取 client 就地构造 future，所以这里不需要闭包：
/// ```ignore
/// let client = state.client();
/// let dto: response::CloudsearchResponseDto = fetch(state, app, client.cloudsearch(&q)).await?;
/// ```
///
/// 本函数只做四件与具体接口无关、但每次请求都躲不掉的事：
/// 1. 超时（crate 不设）
/// 2. 传输错误归一（`NcmError` → `NcmApiError`）
/// 3. 响应 cookie 合并回写（crate 不会自己写回，且无 getter 可读）
/// 4. wire 归一（整数型浮点 / 并存的 `msg`+`message`）+ 反序列化
pub async fn fetch<D>(
    state: &NcmState,
    app_handle: &tauri::AppHandle,
    fut: impl Future<Output = ApiResult>,
) -> Result<D>
where
    D: DeserializeOwned,
{
    let mut resp = tokio::time::timeout(REQUEST_TIMEOUT, fut)
        .await
        .map_err(|_| NetError::Network {
            message: "请求超时".to_string(),
        })?
        .map_err(from_ncm)?;

    if !resp.cookie.is_empty() {
        state.merge_cookie(app_handle, &resp.cookie);
    }

    let mut value = resp.body.take();
    normalize_numbers(&mut value);
    collapse_message_aliases(&mut value);
    serde_json::from_value(value).map_err(|e| NetError::Decode {
        message: e.to_string(),
    })
}

/// 递归把「整数型浮点」转换为整数；真分数（如 4.5）保持原样。
fn normalize_numbers(value: &mut Value) {
    match value {
        Value::Number(n) => {
            if let Some(f) = n.as_f64() {
                if f.fract() == 0.0 && f >= i64::MIN as f64 && f <= i64::MAX as f64 {
                    *value = Value::Number(Number::from(f as i64));
                }
            }
        }
        Value::Array(items) => items.iter_mut().for_each(normalize_numbers),
        Value::Object(map) => map.values_mut().for_each(normalize_numbers),
        _ => {}
    }
}

/// 折叠并存的 `msg` / `message` 两个键。
///
/// 网易云部分接口的失败态会**同时**返回两者，例如 `/api/w/login/cellphone`：
/// `{"code":502,"message":"账号或密码错误","msg":"账号或密码错误"}`。
/// 而 DTO 用 `#[serde(alias = "msg")]` 兼容两种拼写 —— serde 的 alias 在同一对象里
/// 看到两个键映射到同一字段时会直接判 `duplicate field`，于是解码失败（Decode 错误）
/// 顶掉了真实的业务错误（这里的 code 502 + 文案）。
///
/// 所以在反序列化前把并存的两键折叠为一个（统一留在 `message`，优先保留非空值）；
/// 只有 `msg` 时不动，交给 DTO 的 alias。
fn collapse_message_aliases(value: &mut Value) {
    match value {
        Value::Object(map) => {
            if map.contains_key("msg") && map.contains_key("message") {
                let fallback = map.remove("msg");
                let message_is_usable = match map.get("message") {
                    None | Some(Value::Null) => false,
                    Some(Value::String(s)) => !s.trim().is_empty(),
                    Some(_) => true,
                };
                if !message_is_usable {
                    if let Some(msg) = fallback {
                        map.insert("message".to_string(), msg);
                    }
                }
            }
            map.values_mut().for_each(collapse_message_aliases);
        }
        Value::Array(items) => items.iter_mut().for_each(collapse_message_aliases),
        _ => {}
    }
}

/// 可选参数写入 Query：`None` 时跳过。
pub fn opt(query: Query, key: &str, value: Option<&str>) -> Query {
    match value {
        Some(v) => query.param(key, v),
        None => query,
    }
}

/// 验证码（短信）登录 `/api/w/login/cellphone`。
///
/// 不用 `ApiClient::login_cellphone` 走这条路的原因：ncm-api-rs 在读 Query 里的 `captcha` 时
/// 会把 **captcha 同时写进 `password`**（注释里写着“Node.js 在有 captcha 时 password 字段也设为
/// captcha 的值”）。但上游 Node 那行是计算属性：
///
/// ```js
/// captcha: query.captcha,
/// [query.captcha ? 'captcha' : 'password']: query.captcha ? query.captcha : md5(query.password),
/// ```
///
/// captcha 存在时计算出的键是 `captcha`（重复赋值同一键），**根本不会产生 `password` 字段**。
/// 多发的 `password` 会让服务端走密码校验分支，于是永远返回 `502 账号或密码错误`：
///
/// ```text
/// 现状 (captcha + password) -> {"code":502,"message":"账号或密码错误"}
/// 上游 (只有 captcha)        -> 验证码错误 / 正常登录
/// ```
///
/// 所以这里按上游语义自己构造请求体：有 captcha 就不发 `password`。
pub async fn login_cellphone_by_captcha(
    client: &ApiClient,
    phone: &str,
    captcha: &str,
    countrycode: Option<&str>,
) -> ApiResult {
    let data = json!({
        "type": "1",
        "https": "true",
        "phone": phone,
        "countrycode": countrycode.unwrap_or("86"),
        "captcha": captcha,
        "remember": "true",
    });
    client
        .request(
            "/api/w/login/cellphone",
            data,
            RequestOption {
                crypto: CryptoType::Weapi,
                ..Default::default()
            },
        )
        .await
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn collapse_message_aliases_dedupes_login_failure_body() {
        let mut value = json!({
            "code": 502,
            "message": "账号或密码错误",
            "msg": "账号或密码错误"
        });
        collapse_message_aliases(&mut value);
        assert_eq!(value, json!({ "code": 502, "message": "账号或密码错误" }));
    }

    #[test]
    fn collapse_message_aliases_prefers_non_empty() {
        let mut value = json!({ "message": "", "msg": "验证码错误" });
        collapse_message_aliases(&mut value);
        assert_eq!(value, json!({ "message": "验证码错误" }));
    }

    #[test]
    fn collapse_message_aliases_keeps_lone_msg_for_alias() {
        let mut value = json!({ "code": 400, "msg": "验证码错误" });
        collapse_message_aliases(&mut value);
        assert_eq!(value, json!({ "code": 400, "msg": "验证码错误" }));
    }

    #[test]
    fn collapse_message_aliases_walks_nested_structures() {
        let mut value = json!({
            "data": [{ "message": "", "msg": "a" }],
            "nested": { "message": "b", "msg": "c" }
        });
        collapse_message_aliases(&mut value);
        assert_eq!(
            value,
            json!({ "data": [{ "message": "a" }], "nested": { "message": "b" } })
        );
    }
}
