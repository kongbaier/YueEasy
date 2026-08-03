use std::future::Future;

use ncm_api_rs::{ApiClient, Query};
use serde_json::Value;

use super::cookie::{merge_cookies, persist_cookie};
use super::NcmState;

/// ncm-api-rs 未在 crate 根导出 `Result`，这里显式别名。
type ApiResult = std::result::Result<ncm_api_rs::ApiResponse, ncm_api_rs::NcmError>;

/// 统一执行一次 API 调用：
/// 1. 注入当前登录 cookie
/// 2. 调用具体接口（闭包按值接收 client 与 query，内部 `async move` 执行）
/// 3. 若响应携带新 cookie（如登录接口），合并并持久化
pub async fn run<F, Fut>(
    state: &NcmState,
    app_handle: &tauri::AppHandle,
    query: Query,
    call: F,
) -> Result<Value, String>
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

    let mut resp = call(client, query).await.map_err(|e| e.to_string())?;

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

/// 可选参数写入 Query：`None` 时跳过。
pub fn opt(query: Query, key: &str, value: Option<&str>) -> Query {
    match value {
        Some(v) => query.param(key, v),
        None => query,
    }
}
