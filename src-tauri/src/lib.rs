mod api;
mod platform;
mod storage;
mod system;

use tauri::Manager;

use crate::api::ncm::NcmState;
use crate::storage::cache::CacheState;
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
        .manage(Database::default())
        .manage(CacheState::default())
        .manage(NcmState::default())
        .setup(|app| {
            let handle = app.handle();

            if let Some(w) = handle.get_webview_window("main") {
                let _ = w.show();
            }

            // 初始化系统媒体会话（媒体键 + 系统媒体控制）
            if let Err(e) = system::media_session::setup(handle) {
                eprintln!("Failed to setup media session handler: {}", e);
            }

            app.state::<NcmState>().restore_cookie(handle);

            system::window::setup(handle)?;
            system::tray::setup(handle)?;
            platform::accent_color::watch_accent_color(handle.clone());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            api::ncm::commands::auth::ncm_login_cellphone,
            api::ncm::commands::auth::ncm_captcha_sent,
            api::ncm::commands::auth::ncm_captcha_verify,
            api::ncm::commands::auth::ncm_login_qr_key,
            api::ncm::commands::auth::ncm_login_qr_create,
            api::ncm::commands::auth::ncm_login_qr_check,
            api::ncm::commands::auth::ncm_login_status,
            api::ncm::commands::auth::ncm_set_cookie,
            api::ncm::commands::auth::ncm_get_cookie,
            api::ncm::commands::auth::ncm_clear_cookie,
            api::ncm::commands::search::ncm_cloudsearch,
            api::ncm::commands::search::ncm_search_suggest,
            api::ncm::commands::search::ncm_search_hot,
            api::ncm::commands::song::ncm_album,
            api::ncm::commands::song::ncm_song_url_v1,
            api::ncm::commands::song::ncm_song_detail,
            api::ncm::commands::song::ncm_lyric,
            api::ncm::commands::song::ncm_lyric_new,
            api::ncm::commands::song::ncm_like,
            api::ncm::commands::song::ncm_likelist,
            api::ncm::commands::song::ncm_record_recent_song,
            api::ncm::commands::playlist::ncm_playlist_detail,
            api::ncm::commands::playlist::ncm_user_playlist,
            api::ncm::commands::playlist::ncm_personalized,
            api::ncm::commands::playlist::ncm_top_playlist,
            api::ncm::commands::playlist::ncm_playlist_hot,
            api::ncm::commands::playlist::ncm_recommend_resource,
            api::ncm::commands::discover::ncm_banner,
            api::ncm::commands::discover::ncm_recommend_songs,
            api::ncm::commands::discover::ncm_personal_fm,
            api::ncm::commands::discover::ncm_fm_trash,
            api::ncm::commands::discover::ncm_homepage_dragon_ball,
            api::ncm::commands::discover::ncm_playmode_intelligence_list,
            api::ncm::commands::comment::ncm_comment_playlist,
            api::ncm::commands::comment::ncm_comment_music,
            platform::accent_color::get_accent_color,
            storage::cache::cache_get,
            storage::cache::cache_set,
            storage::cache::cache_delete,
            storage::cache::cache_clear,
            storage::cache::cache_size,
            storage::play_history::history_add,
            storage::play_history::history_get,
            storage::play_history::history_mark_synced,
            system::media_session::update_media_session_metadata,
            system::media_session::update_media_session_status,
            system::media_session::update_media_session_position,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
