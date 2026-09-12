use std::collections::HashMap;

use tauri_plugin_store::StoreExt;

/// 键值解析：跳过空 key / 空 value。
/// 注意不做 urlencode —— 网易云 cookie 的值本身可能是已编码内容，二次编码会写坏
/// （这也是不复用 `ncm_api_rs::util::cookie` 里那几个工具函数的原因）。
fn parse_into(map: &mut HashMap<String, String>, raw: &str) {
    for part in raw.split(';') {
        let Some((k, v)) = part.split_once('=') else {
            continue;
        };
        let (k, v) = (k.trim(), v.trim());
        if !k.is_empty() && !v.is_empty() {
            map.insert(k.to_string(), v.to_string());
        }
    }
}

/// 合并 cookie：`new_cookies` 按 key 覆盖既有值，同名去重。
pub fn merge_cookies(existing: &str, new_cookies: &[String]) -> String {
    let mut map: HashMap<String, String> = HashMap::new();
    parse_into(&mut map, existing);
    for cookie_str in new_cookies {
        parse_into(&mut map, cookie_str);
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
