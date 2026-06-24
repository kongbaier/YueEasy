mod commands;
mod db;
mod ncm;
mod utils;

use serde::Serialize;
use tauri::{Emitter, Manager, WebviewUrl, WebviewWindowBuilder};
use tauri::menu::{MenuBuilder, MenuItemBuilder};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::window::{Effect, EffectState};
use tauri::utils::config::WindowEffectsConfig;
use tauri_plugin_media::{MediaControlEventType, MediaExt};
use tauri_plugin_window_state::{StateFlags, WindowExt};

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "event", rename_all = "camelCase")]
enum SmtcEvent {
    Play,
    Pause,
    Toggle,
    Next,
    Previous,
    Stop,
    FastForward,
    Rewind,
    #[serde(rename = "setPosition")]
    SetPosition {
        position: f64,
    },
    #[serde(rename = "seekTo")]
    SeekTo {
        position: f64,
    },
    #[serde(rename = "setPlaybackRate")]
    SetPlaybackRate {
        rate: f64,
    },
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_window_state::Builder::new().build())
        .plugin(tauri_plugin_media::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            let window = WebviewWindowBuilder::new(app, "main", WebviewUrl::default())
                .title("乐易")
                .inner_size(1280.0, 768.0)
                .min_inner_size(800.0, 600.0)
                .resizable(true)
                .transparent(true)
                .decorations(false)
                .visible(false)
                .additional_browser_args("--disable-features=MediaSessionService,msWebOOUI,msPdfOOUI,msSmartScreenProtection")
                .effects(WindowEffectsConfig {
                    effects: vec![Effect::Mica],
                    color: None,
                    radius: None,
                    state: Some(EffectState::FollowsWindowActiveState),
                })
                .build()
                .expect("failed to build window");

            window
                .restore_state(StateFlags::all())
                .expect("failed to restore window state");

            window.show().expect("failed to show window");

            // 系统托盘
            let icon_bytes = include_bytes!("../icons/32x32.png");
            let icon_img = image::load_from_memory(icon_bytes)
                .expect("failed to load tray icon")
                .to_rgba8();
            let (icon_w, icon_h) = icon_img.dimensions();
            let tray_icon = tauri::image::Image::new_owned(
                icon_img.into_raw(),
                icon_w,
                icon_h,
            );
            let tray_menu = MenuBuilder::new(app)
                .item(&MenuItemBuilder::with_id("show", "显示窗口").build(app)?)
                .item(&MenuItemBuilder::with_id("quit", "退出").build(app)?)
                .build()?;
            TrayIconBuilder::new()
                .icon(tray_icon)
                .menu(&tray_menu)
                .tooltip("乐易")
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        if let Some(window) = tray.app_handle().get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                })
                .on_menu_event(|app, event| match event.id().as_ref() {
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    "quit" => {
                        app.exit(0);
                    }
                    _ => {}
                })
                .build(app)?;

            let app_data = app
                .path()
                .app_data_dir()
                .expect("failed to resolve app data dir");
            std::fs::create_dir_all(&app_data).ok();

            let db = db::connection::Database::new(app_data.clone())
                .map_err(|e| Box::<dyn std::error::Error>::from(e.to_string()))?;

            let saved_cookie = db
                .conn
                .lock()
                .ok()
                .and_then(|conn| {
                    conn.query_row::<String, _, _>(
                        "SELECT value FROM settings WHERE key = 'auth_cookie'",
                        [],
                        |row| row.get(0),
                    )
                    .ok()
                })
                .unwrap_or_default();

            if saved_cookie.is_empty() {
                log::info!("[setup] no saved cookie found in SQLite");
            } else {
                log::info!(
                    "[setup] restored cookie from SQLite (len={})",
                    saved_cookie.len()
                );
            }

            app.manage(db);

            // 窗口关闭行为：根据设置决定隐藏到托盘还是退出
            {
                let app_handle = app.handle().clone();
                window.on_window_event(move |event| {
                    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                        let db = app_handle.state::<db::connection::Database>();
                        let behavior = db
                            .conn
                            .lock()
                            .ok()
                            .and_then(|conn| {
                                conn.query_row::<String, _, _>(
                                    "SELECT value FROM settings WHERE key = 'close_behavior'",
                                    [],
                                    |row| row.get(0),
                                )
                                .ok()
                            })
                            .unwrap_or_else(|| "quit".to_string());
                        if behavior == "hide" {
                            api.prevent_close();
                            if let Some(w) = app_handle.get_webview_window("main") {
                                let _ = w.hide();
                            }
                        }
                    }
                });
            }

            // 恢复保存的窗口效果
            {
                let db = app.state::<db::connection::Database>();
                let saved_effect = db
                    .conn
                    .lock()
                    .ok()
                    .and_then(|conn| {
                        conn.query_row::<String, _, _>(
                            "SELECT value FROM settings WHERE key = 'window_effect'",
                            [],
                            |row| row.get(0),
                        )
                        .ok()
                    })
                    .unwrap_or_else(|| "mica".to_string());

                let effect = match saved_effect.as_str() {
                    "tabbed" => Effect::Tabbed,
                    "acrylic" => Effect::Acrylic,
                    "blur" => Effect::Blur,
                    _ => Effect::Mica,
                };

                if let Err(e) = window.set_effects(WindowEffectsConfig {
                    effects: vec![effect],
                    color: None,
                    radius: None,
                    state: Some(EffectState::FollowsWindowActiveState),
                }) {
                    log::error!("[setup] failed to apply saved window effect: {e}");
                }
            }

            let ncm_state = ncm::NcmState::new();
            if !saved_cookie.is_empty() {
                if let Ok(mut inner) = ncm_state.inner.lock() {
                    inner.cookie = saved_cookie;
                }
            }
            app.manage(ncm_state);

            // 将系统媒体控制事件桥接到前端
            let handle = app.handle().clone();
            app.media().set_event_handler(move |event| {
                let payload = match event.event_type {
                    MediaControlEventType::Play => SmtcEvent::Play,
                    MediaControlEventType::Pause => SmtcEvent::Pause,
                    MediaControlEventType::PlayPause => SmtcEvent::Toggle,
                    MediaControlEventType::Stop => SmtcEvent::Stop,
                    MediaControlEventType::Next => SmtcEvent::Next,
                    MediaControlEventType::Previous => SmtcEvent::Previous,
                    MediaControlEventType::FastForward => SmtcEvent::FastForward,
                    MediaControlEventType::Rewind => SmtcEvent::Rewind,
                    MediaControlEventType::SeekTo(pos) => SmtcEvent::SeekTo { position: pos },
                    MediaControlEventType::SetPosition(pos) => {
                        SmtcEvent::SetPosition { position: pos }
                    }
                    MediaControlEventType::SetPlaybackRate(rate) => {
                        SmtcEvent::SetPlaybackRate { rate }
                    }
                };
                let _ = handle.emit("smtc-event", payload);
            });

            // 监听 Windows 系统主题色变化
            commands::accent_color::watch_accent_color(app.handle().clone());

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
            commands::history::history_add,
            commands::history::history_get,
            commands::history::history_mark_synced,
            commands::settings::get_setting,
            commands::settings::set_setting,
            commands::download::download_song,
            commands::smtc::init_smtc,
            commands::smtc::update_smtc_metadata,
            commands::smtc::update_smtc_status,
            commands::smtc::update_smtc_position,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
