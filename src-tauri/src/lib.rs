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
            app.manage(db);

            let ncm_state = ncm::NcmState::new();
            let port_cell = ncm_state.clone_port();
            app.manage(ncm_state);

            tauri::async_runtime::spawn(async move {
                match ncm::server::start().await {
                    Ok((port, _handle)) => {
                        *port_cell.lock().unwrap() = Some(port);
                    }
                    Err(e) => {
                        eprintln!("NCM server error: {}", e);
                    }
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            ncm::server::ncm_health_check,
            ncm::server::get_ncm_port,
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
