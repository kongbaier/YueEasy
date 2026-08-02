mod commands;
mod db;
mod ncm;
mod media_session;
mod tray;
mod utils;

use tauri::utils::config::WindowEffectsConfig;
use tauri::window::{Effect, EffectState};
use tauri::Manager;
use tauri_plugin_store::StoreExt;

use crate::commands::cache::CacheState;
use crate::db::connection::Database;
use crate::ncm::NcmState;

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
            if let Err(e) = crate::media_session::setup(&handle) {
                eprintln!("Failed to setup media session handler: {}", e);
            }

            app.state::<NcmState>().restore_cookie(handle);

            if let Some(w) = handle.get_webview_window("main") {
                let handle = handle.clone();
                w.on_window_event(move |event| {
                    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                        if handle
                            .store("settings.json")
                            .ok()
                            .and_then(|s| {
                                s.get("close_behavior")
                                    .and_then(|v| v.as_str().map(String::from))
                            })
                            .unwrap_or_else(|| "quit".to_string())
                            == "hide"
                        {
                            api.prevent_close();
                            if let Some(w) = handle.get_webview_window("main") {
                                let _ = w.hide();
                                let _ = w.as_ref().hide();
                            }
                        }
                    }
                });
            }

            if let Ok(store) = handle.store("settings.json") {
                let effect = match store
                    .get("window_effect")
                    .and_then(|v| v.as_str().map(|s| s.to_string()))
                    .unwrap_or_else(|| "mica".to_string())
                    .as_str()
                {
                    "tabbed" => Effect::Tabbed,
                    "acrylic" => Effect::Acrylic,
                    "blur" => Effect::Blur,
                    _ => Effect::Mica,
                };
                if let Some(w) = handle.get_webview_window("main") {
                    w.set_effects(WindowEffectsConfig {
                        effects: vec![effect],
                        color: None,
                        radius: None,
                        state: Some(EffectState::FollowsWindowActiveState),
                    })
                    .ok();
                }
            }

            tray::setup(handle)?;
            commands::accent_color::watch_accent_color(handle.clone());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            ncm::commands::ncm_request,
            ncm::commands::ncm_set_cookie,
            ncm::commands::ncm_get_cookie,
            ncm::commands::ncm_clear_cookie,
            commands::accent_color::get_accent_color,
            commands::cache::cache_get,
            commands::cache::cache_set,
            commands::cache::cache_delete,
            commands::cache::cache_clear,
            commands::cache::cache_size,
            commands::history::history_add,
            commands::history::history_get,
            commands::history::history_mark_synced,
            commands::download::download_song,
            commands::media_session::update_media_session_metadata,
            commands::media_session::update_media_session_status,
            commands::media_session::update_media_session_position,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
