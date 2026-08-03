use tauri::utils::config::WindowEffectsConfig;
use tauri::window::{Effect, EffectState};
use tauri::Manager;
use tauri_plugin_store::StoreExt;

/// 窗口行为：关闭行为（hide/quit）与窗口特效。
pub fn setup(handle: &tauri::AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    apply_close_behavior(handle);
    apply_window_effect(handle);
    Ok(())
}

fn apply_close_behavior(handle: &tauri::AppHandle) {
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
}

fn apply_window_effect(handle: &tauri::AppHandle) {
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
}
