mod commands;
mod db;
mod ncm;
mod utils;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
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

            let ncm_state = ncm::NcmState::new();
            if !saved_cookie.is_empty() {
                if let Ok(mut inner) = ncm_state.inner.lock() {
                    inner.cookie = saved_cookie;
                }
            }
            app.manage(ncm_state);

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            ncm::commands::ncm_request,
            ncm::commands::ncm_set_cookie,
            ncm::commands::ncm_get_cookie,
            ncm::commands::ncm_clear_cookie,
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
