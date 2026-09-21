mod app;
mod commands;
mod model;
mod netease;
mod platform;
mod service;
mod storage;

use tauri::Manager;

use crate::app::state::LikeState;
use crate::netease::NcmState;
use crate::storage::db::Database;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(
            tauri_plugin_window_state::Builder::default()
                .with_state_flags(
                    tauri_plugin_window_state::StateFlags::SIZE
                        | tauri_plugin_window_state::StateFlags::POSITION
                        | tauri_plugin_window_state::StateFlags::MAXIMIZED,
                )
                .build(),
        )
        .plugin(tauri_plugin_media::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.show();
                let _ = w.set_focus();
            }
        }))
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_cache::init())
        .manage(Database::default())
        .manage(NcmState::default())
        .manage(LikeState::default())
        .setup(|app| {
            let handle = app.handle();

            // 先应用窗口特效再显示：材质是 DWM 窗口属性，对隐藏窗口即生效；
            // 顺序颠倒会让窗口先以「无材质」状态呈现一帧。
            platform::window::setup(handle)?;

            if let Some(w) = handle.get_webview_window("main") {
                let _ = w.show();
            }

            // 初始化系统媒体会话（媒体键 + 系统媒体控制）
            if let Err(e) = platform::media_session::setup(handle) {
                eprintln!("Failed to setup media session handler: {}", e);
            }

            app.state::<NcmState>().restore_cookie(handle);

            platform::tray::setup(handle)?;
            platform::accent_color::watch_accent_color(handle.clone());

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::ncm::auth::ncm_login_cellphone,
            commands::ncm::auth::ncm_captcha_sent,
            commands::ncm::auth::ncm_captcha_verify,
            commands::ncm::auth::ncm_login_qr_key,
            commands::ncm::auth::ncm_login_qr_create,
            commands::ncm::auth::ncm_login_qr_check,
            commands::ncm::auth::ncm_login_status,
            commands::ncm::auth::ncm_set_cookie,
            commands::ncm::auth::ncm_get_cookie,
            commands::ncm::auth::ncm_clear_cookie,
            commands::ncm::search::ncm_cloudsearch,
            commands::ncm::search::ncm_search_suggest,
            commands::ncm::search::ncm_search_hot,
            commands::ncm::song::ncm_album,
            commands::ncm::song::ncm_song_url_v1,
            commands::ncm::song::ncm_song_detail,
            commands::ncm::song::ncm_lyric,
            commands::ncm::song::ncm_lyric_new,
            commands::ncm::song::ncm_like,
            commands::ncm::song::ncm_likelist,
            commands::ncm::song::ncm_record_recent_song,
            commands::ncm::playlist::ncm_playlist_detail,
            commands::ncm::playlist::ncm_user_playlist,
            commands::ncm::playlist::ncm_personalized,
            commands::ncm::playlist::ncm_top_playlist,
            commands::ncm::playlist::ncm_playlist_hot,
            commands::ncm::playlist::ncm_recommend_resource,
            commands::ncm::discover::ncm_banner,
            commands::ncm::discover::ncm_recommend_songs,
            commands::ncm::discover::ncm_personal_fm,
            commands::ncm::discover::ncm_fm_trash,
            commands::ncm::discover::ncm_homepage_dragon_ball,
            commands::ncm::discover::ncm_playmode_intelligence_list,
            commands::ncm::comment::ncm_comment_playlist,
            commands::ncm::comment::ncm_comment_music,
            commands::accent::get_accent_color,
            commands::history::history_add,
            commands::history::history_get,
            commands::history::history_mark_synced,
            commands::like::like_init,
            commands::like::like_toggle,
            commands::like::like_get_ids,
            commands::media_session::update_media_session_metadata,
            commands::media_session::update_media_session_status,
            commands::media_session::update_media_session_position,
            commands::query::resolve_play_url,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
