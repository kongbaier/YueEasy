use tauri::utils::config::WindowEffectsConfig;
use tauri::window::{Effect, EffectState};
use tauri::Manager;
use tauri_plugin_store::StoreExt;

/// 窗口行为：窗口特效。
/// 关闭行为（hide/quit）已迁移到前端：由 useWindowState.close 依 store 判断（decorations:false 下前端是唯一关闭入口）。
pub fn setup(handle: &tauri::AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    apply_window_effect(handle);
    Ok(())
}

fn apply_window_effect(handle: &tauri::AppHandle) {
    if let Ok(store) = handle.store("settings.json") {
        let effect = match store
            .get("windowEffect")
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
