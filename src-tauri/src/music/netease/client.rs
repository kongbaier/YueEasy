use std::future::Future;
use std::time::Duration;

use ncm_api_rs::{ApiClient, Query};
use serde::de::DeserializeOwned;
use serde_json::{Number, Value};

use super::cookie::{merge_cookies, persist_cookie};
use super::error::{from_ncm, NcmApiError, Result};
use super::NcmState;

/// ncm-api-rs 未在 crate 根导出 `Result`，这里显式别名。
type ApiResult = std::result::Result<ncm_api_rs::ApiResponse, ncm_api_rs::NcmError>;

/// 统一执行一次 API 调用并返回**原始 JSON**（仅适配层内部使用）：
/// 1. 注入当前登录 cookie
/// 2. 调用具体接口（闭包按值接收 client 与 query，内部 `async move` 执行）
/// 3. 若响应携带新 cookie（如登录接口），合并并持久化
///
/// `Value` 只允许存在于本函数与 `run_dto` 之间，绝不跨命令边界。
async fn run<F, Fut>(
    state: &NcmState,
    app_handle: &tauri::AppHandle,
    query: Query,
    call: F,
) -> Result<Value>
where
    F: FnOnce(ApiClient, Query) -> Fut,
    Fut: Future<Output = ApiResult>,
{
    let (client, query) = {
        let inner = state.inner.lock().unwrap();
        let query = if inner.cookie.is_empty() {
            query
        } else {
            query.cookie(&inner.cookie)
        };
        (inner.client.clone(), query)
    };

    let mut resp = tokio::time::timeout(Duration::from_secs(10), call(client, query))
        .await
        .map_err(|_| NcmApiError::Network {
            message: "请求超时".to_string(),
        })?
        .map_err(from_ncm)?;

    if !resp.cookie.is_empty() {
        let new_cookie = {
            let mut inner = state.inner.lock().unwrap();
            let new_cookie = merge_cookies(&inner.cookie, &resp.cookie);
            inner.cookie = new_cookie.clone();
            new_cookie
        };
        persist_cookie(app_handle, &new_cookie);
    }

    Ok(resp.body.take())
}

/// 类型化取数入口：适配层边界把原始 JSON 立即反序列化为 DTO。
/// 命令层只与 DTO / Entity 打交道。
pub async fn run_dto<D, F, Fut>(
    state: &NcmState,
    app_handle: &tauri::AppHandle,
    query: Query,
    call: F,
) -> Result<D>
where
    D: DeserializeOwned,
    F: FnOnce(ApiClient, Query) -> Fut,
    Fut: Future<Output = ApiResult>,
{
    let mut value = run(state, app_handle, query, call).await?;
    // 网易云部分数值以浮点字面量返回（如时间戳 22157.0），先把整数型浮点归一为整数，
    // 避免 DTO 中 i64 字段解码失败（invalid type: floating point, expected i64）。
    normalize_numbers(&mut value);
    serde_json::from_value(value).map_err(|e| NcmApiError::Decode {
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

/// 可选参数写入 Query：`None` 时跳过。
pub fn opt(query: Query, key: &str, value: Option<&str>) -> Query {
    match value {
        Some(v) => query.param(key, v),
        None => query,
    }
}
