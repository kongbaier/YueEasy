use std::future::Future;
use std::time::Duration;

use ncm_api_rs::Query;
use serde::de::DeserializeOwned;
use serde_json::{Number, Value};

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
/// 4. 整数型浮点归一 + 反序列化（网易云会用 `22157.0` 表示时间戳）
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

/// 可选参数写入 Query：`None` 时跳过。
pub fn opt(query: Query, key: &str, value: Option<&str>) -> Query {
    match value {
        Some(v) => query.param(key, v),
        None => query,
    }
}
