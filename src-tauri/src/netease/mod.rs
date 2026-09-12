//! 网络层：`ncm_api_rs` 的薄封装。
//!
//! 只负责三件事——持有会话（client + cookie）、发一次请求、把失败归一。
//! **不**认识任何 DTO / Entity（那是 [`crate::model`] 的事），
//! **不**感知业务 code（那是 [`crate::model::error::check_code`] 的事）。
//!
//! 依赖方向：`cmd → service → model → netease`，本模块不依赖同 crate 的任何其他层。

pub(crate) mod client;
pub(crate) mod cookie;
pub(crate) mod error;

use std::sync::Mutex;
use tauri_plugin_store::StoreExt;

use self::cookie::{merge_cookies, persist_cookie};

pub struct NcmState {
    pub inner: Mutex<NcmInner>,
}

/// NCM 客户端状态。
///
/// cookie 有「内存态」与「`ApiClient` 内部」两份，二者必须同步：前者用于合并响应
/// cookie 与持久化（`ApiClient` 的 cookie 字段无 getter，读不回来），后者用于请求时
/// 自动注入（无需逐请求 `Query::cookie`）。`cookie` 字段私有 + 唯一的 `set_cookie`
/// 写入口，就是为了锁死这个不变量。
pub struct NcmInner {
    pub client: ncm_api_rs::ApiClient,
    cookie: String,
}

impl NcmInner {
    /// cookie 唯一写入口：内存态与 `ApiClient` 一次改完，避免两处写岔。
    fn set_cookie(&mut self, cookie: String) {
        self.client.set_cookie(cookie.clone());
        self.cookie = cookie;
    }

    fn cookie(&self) -> &str {
        &self.cookie
    }
}

impl NcmState {
    pub fn new() -> Self {
        Self {
            inner: Mutex::new(NcmInner {
                client: ncm_api_rs::create_client(None),
                cookie: String::new(),
            }),
        }
    }

    /// 客户端快照（内部已持有当前 cookie）。`ApiClient` 的 clone 只复制
    /// `reqwest::Client` 的 Arc 句柄，开销可忽略。
    pub fn client(&self) -> ncm_api_rs::ApiClient {
        self.inner.lock().unwrap().client.clone()
    }

    /// 当前 cookie。
    pub fn cookie(&self) -> String {
        self.inner.lock().unwrap().cookie().to_string()
    }

    /// 写入 cookie：内存态 + `ApiClient` + 本地存储三者同步的唯一入口。
    pub fn set_cookie(&self, handle: &tauri::AppHandle, cookie: String) {
        self.inner.lock().unwrap().set_cookie(cookie.clone());
        persist_cookie(handle, &cookie);
    }

    /// 合并响应携带的 cookie（按 key 覆盖旧值）并写回，返回合并结果。
    pub fn merge_cookie(&self, handle: &tauri::AppHandle, new_cookies: &[String]) -> String {
        let merged = {
            let mut inner = self.inner.lock().unwrap();
            let merged = merge_cookies(inner.cookie(), new_cookies);
            inner.set_cookie(merged.clone());
            merged
        };
        // 持久化是文件 IO，放在锁外做
        persist_cookie(handle, &merged);
        merged
    }

    pub fn restore_cookie(&self, handle: &tauri::AppHandle) {
        let cookie = handle
            .store("settings.json")
            .ok()
            .and_then(|s| {
                s.get("auth_cookie")
                    .and_then(|v| v.as_str().map(|s| s.to_string()))
            })
            .filter(|c| !c.is_empty());
        match cookie {
            Some(c) => {
                log::info!("[ncm] restored cookie from store (len={})", c.len());
                // 来源就是 store，无需回写
                self.inner.lock().unwrap().set_cookie(c);
            }
            None => log::info!("[ncm] no saved cookie found"),
        }
    }
}

impl Default for NcmState {
    fn default() -> Self {
        Self::new()
    }
}
