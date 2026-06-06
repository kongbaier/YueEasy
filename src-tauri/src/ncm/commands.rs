use std::collections::HashMap;

use ncm_api_rs::Query;
use serde_json::Value;

use super::NcmState;
use crate::db::connection::Database;

fn merge_cookies(existing: &str, new_cookies: &[String]) -> String {
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
        .map(|(k, v)| format!("{}={}", k, v))
        .collect::<Vec<_>>()
        .join("; ")
}

fn build_query(params: &HashMap<String, String>, cookie: &str) -> Query {
    let mut q = Query::new();
    if !cookie.is_empty() {
        q = q.cookie(cookie);
    }
    for (k, v) in params {
        q = q.param(k, v);
    }
    q
}

#[tauri::command]
pub async fn ncm_request(
    state: tauri::State<'_, NcmState>,
    db: tauri::State<'_, Database>,
    method: String,
    params: HashMap<String, String>,
) -> Result<Value, String> {
    let (client, query) = {
        let inner = state.inner.lock().unwrap();
        let query = build_query(&params, &inner.cookie);
        (inner.client.clone(), query)
    };

    let response = match method.as_str() {
        "cloudsearch" => client.cloudsearch(&query).await,
        "song_url_v1" => client.song_url_v1(&query).await,
        "song_detail" => client.song_detail(&query).await,
        "lyric" => client.lyric(&query).await,
        "playlist_detail" => client.playlist_detail(&query).await,
        "user_playlist" => client.user_playlist(&query).await,
        "login_cellphone" => client.login_cellphone(&query).await,
        "captcha_sent" => client.captcha_sent(&query).await,
        "captcha_verify" => client.captcha_verify(&query).await,
        "login_qr_key" => client.login_qr_key(&query).await,
        "login_qr_create" => client.login_qr_create(&query).await,
        "login_qr_check" => client.login_qr_check(&query).await,
        "login_status" => client.login_status(&query).await,
        "recommend_songs" => client.recommend_songs(&query).await,
        "personalized" => client.personalized(&query).await,
        "banner" => client.banner(&query).await,
        "top_playlist" => client.top_playlist(&query).await,
        "playlist_hot" => client.playlist_hot(&query).await,
        "recommend_resource" => client.recommend_resource(&query).await,
        "personal_fm" => client.personal_fm(&query).await,
        "like" => client.like(&query).await,
        "likelist" => client.likelist(&query).await,
        "record/recent/song" => client.record_recent_song(&query).await,
        _ => return Err(format!("Unknown method: {method}",)),
    };

    match response {
        Ok(mut resp) => {
            if !resp.cookie.is_empty() {
                let mut inner = state.inner.lock().unwrap();
                let new_cookie = merge_cookies(&inner.cookie, &resp.cookie);
                inner.cookie = new_cookie.clone();
                drop(inner);
                log::info!(
                    "[ncm_request] persisting cookie to SQLite (len={})",
                    new_cookie.len()
                );
                let conn = db.conn.lock().map_err(|e| e.to_string())?;
                conn.execute(
                    "INSERT OR REPLACE INTO settings (key, value) VALUES ('auth_cookie', ?1)",
                    [&new_cookie],
                )
                .map_err(|e| e.to_string())?;
            }
            Ok(resp.body.take())
        }
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
pub async fn ncm_set_cookie(
    state: tauri::State<'_, NcmState>,
    db: tauri::State<'_, Database>,
    cookie: String,
) -> Result<(), String> {
    state.inner.lock().unwrap().cookie = cookie.clone();
    log::info!(
        "[ncm_set_cookie] persisting cookie to SQLite (len={})",
        cookie.len()
    );
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT OR REPLACE INTO settings (key, value) VALUES ('auth_cookie', ?1)",
        [&cookie],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn ncm_get_cookie(state: tauri::State<'_, NcmState>) -> Result<String, String> {
    Ok(state.inner.lock().unwrap().cookie.clone())
}

#[tauri::command]
pub async fn ncm_clear_cookie(
    state: tauri::State<'_, NcmState>,
    db: tauri::State<'_, Database>,
) -> Result<(), String> {
    log::info!("[ncm_clear_cookie] clearing cookie from memory and SQLite");
    state.inner.lock().unwrap().cookie.clear();
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM settings WHERE key = 'auth_cookie'", [])
        .map_err(|e| e.to_string())?;
    Ok(())
}
