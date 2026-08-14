mod cmd;
mod core;
mod infra;
mod service;
mod state;

use tauri::Manager;

use crate::infra::ncm::NcmState;
use crate::infra::storage::cache::CacheState;
use crate::infra::storage::db::Database;

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
        .manage(state::PlayerState::default())
        .manage(state::LikeState::default())
        .setup(|app| {
            let handle = app.handle();

            if let Some(w) = handle.get_webview_window("main") {
                let _ = w.show();
            }

            // 初始化系统媒体会话（媒体键 + 系统媒体控制）
            if let Err(e) = infra::platform::media_session::setup(handle) {
                eprintln!("Failed to setup media session handler: {}", e);
            }

            app.state::<NcmState>().restore_cookie(handle);

            // Phase F：从 SQLite 恢复上次播放器状态（崩溃/重启续播）
            {
                let db = app.state::<Database>();
                let player = app.state::<state::PlayerState>();
                player.try_restore(&db);
            }

            infra::platform::window::setup(handle)?;
            infra::platform::tray::setup(handle)?;
            infra::platform::accent_color::watch_accent_color(handle.clone());

            // 音频迁移 Rust：启动 ended 检测后台任务（歌曲播完自动切下一首）
            cmd::player::start_ended_watcher(handle.clone());

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            cmd::ncm::auth::ncm_login_cellphone,
            cmd::ncm::auth::ncm_captcha_sent,
            cmd::ncm::auth::ncm_captcha_verify,
            cmd::ncm::auth::ncm_login_qr_key,
            cmd::ncm::auth::ncm_login_qr_create,
            cmd::ncm::auth::ncm_login_qr_check,
            cmd::ncm::auth::ncm_login_status,
            cmd::ncm::auth::ncm_set_cookie,
            cmd::ncm::auth::ncm_get_cookie,
            cmd::ncm::auth::ncm_clear_cookie,
            cmd::ncm::search::ncm_cloudsearch,
            cmd::ncm::search::ncm_search_suggest,
            cmd::ncm::search::ncm_search_hot,
            cmd::ncm::song::ncm_album,
            cmd::ncm::song::ncm_song_url_v1,
            cmd::ncm::song::ncm_song_detail,
            cmd::ncm::song::ncm_lyric,
            cmd::ncm::song::ncm_lyric_new,
            cmd::ncm::song::ncm_like,
            cmd::ncm::song::ncm_likelist,
            cmd::ncm::song::ncm_record_recent_song,
            cmd::ncm::playlist::ncm_playlist_detail,
            cmd::ncm::playlist::ncm_user_playlist,
            cmd::ncm::playlist::ncm_personalized,
            cmd::ncm::playlist::ncm_top_playlist,
            cmd::ncm::playlist::ncm_playlist_hot,
            cmd::ncm::playlist::ncm_recommend_resource,
            cmd::ncm::discover::ncm_banner,
            cmd::ncm::discover::ncm_recommend_songs,
            cmd::ncm::discover::ncm_personal_fm,
            cmd::ncm::discover::ncm_fm_trash,
            cmd::ncm::discover::ncm_homepage_dragon_ball,
            cmd::ncm::discover::ncm_playmode_intelligence_list,
            cmd::ncm::comment::ncm_comment_playlist,
            cmd::ncm::comment::ncm_comment_music,
            cmd::accent::get_accent_color,
            cmd::cache::cache_get,
            cmd::cache::cache_set,
            cmd::cache::cache_delete,
            cmd::cache::cache_clear,
            cmd::cache::cache_size,
            cmd::history::history_add,
            cmd::history::history_get,
            cmd::history::history_mark_synced,
            cmd::like::like_init,
            cmd::like::like_toggle,
            cmd::like::like_get_ids,
            cmd::media_session::update_media_session_metadata,
            cmd::media_session::update_media_session_status,
            cmd::media_session::update_media_session_position,
            cmd::player::play_track,
            cmd::player::replace_and_play,
            cmd::player::play_queue_at,
            cmd::player::play_next,
            cmd::player::play_prev,
            cmd::player::fm_trash,
            cmd::player::enter_heartbeat,
            cmd::player::set_iteration_strategy,
            cmd::player::set_content_source,
            cmd::player::seek,
            cmd::player::play,
            cmd::player::pause,
            cmd::player::set_volume,
            cmd::player::get_position,
            cmd::player::append_to_queue,
            cmd::player::insert_next,
            cmd::player::remove_from_queue,
            cmd::player::clear_queue,
            cmd::query::resolve_play_url,
            cmd::query::get_player_snapshot,
            cmd::query::get_queue,
            cmd::query::get_full_player_state,
            cmd::player::restore_playback,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
