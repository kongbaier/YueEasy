pub mod commands;

use std::sync::Mutex;
use tauri_plugin_store::StoreExt;

pub struct NcmState {
    pub inner: Mutex<NcmInner>,
}

pub struct NcmInner {
    pub client: ncm_api_rs::ApiClient,
    pub cookie: String,
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

    pub fn restore_cookie(&self, handle: &tauri::AppHandle) {
        let cookie = handle
            .store("settings.json")
            .ok()
            .and_then(|s| s.get("auth_cookie").and_then(|v| v.as_str().map(|s| s.to_string())))
            .filter(|c| !c.is_empty());
        match cookie {
            Some(c) => {
                log::info!("[ncm] restored cookie from store (len={})", c.len());
                self.inner.lock().unwrap().cookie = c;
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

