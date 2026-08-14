use std::collections::HashMap;

use tauri_plugin_store::StoreExt;

pub fn merge_cookies(existing: &str, new_cookies: &[String]) -> String {
    let mut map: HashMap<String, String> = HashMap::new();
    for part in existing.split(';') {
        let kv: Vec<&str> = part.splitn(2, '=').collect();
        if kv.len() == 2 {
            let k = kv[0].trim().to_string();
            let v = kv[1].trim().to_string();
            if !k.is_empty() && !v.is_empty() {
                map.insert(k, v);
            }
        }
    }
    for cookie_str in new_cookies {
        for part in cookie_str.split(';') {
            let kv: Vec<&str> = part.splitn(2, '=').collect();
            if kv.len() == 2 {
                let k = kv[0].trim().to_string();
                let v = kv[1].trim().to_string();
                if !k.is_empty() && !v.is_empty() {
                    map.insert(k, v);
                }
            }
        }
    }
    map.into_iter()
        .map(|(k, v)| format!("{k}={v}"))
        .collect::<Vec<_>>()
        .join("; ")
}

/// 将 cookie 持久化到 settings.json（best-effort，失败不阻断请求）。
pub fn persist_cookie(handle: &tauri::AppHandle, cookie: &str) {
    log::info!("[ncm] persisting cookie (len={})", cookie.len());
    if let Ok(store) = handle.store("settings.json") {
        store.set("auth_cookie", serde_json::json!(cookie));
        store.save().ok();
    }
}
