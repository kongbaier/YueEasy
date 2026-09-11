use serde_json::Value;
use tauri::utils::config::WindowEffectsConfig;
use tauri::window::{Effect, EffectState};
use tauri::Manager;
use tauri_plugin_store::StoreExt;

/// 窗口行为：窗口特效。
/// 关闭行为（hide/quit）已迁移到前端：由 useWindowState.close 依 store 判断（decorations:false 下前端是唯一关闭入口）。
///
/// **必须在 `window.show()` 之前调用**：材质是 DWM 窗口属性（`DwmSetWindowAttribute`），
/// 对隐藏窗口同样生效；反过来先 show 再设置，会露出显示瞬间无材质的一帧。
pub fn setup(handle: &tauri::AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    apply_window_effect(handle);
    Ok(())
}

/// 读取持久化材质。
///
/// 磁盘形状由前端 `shared/services/SettingsService` 独占（沿用 zustand persist 包裹格式）：
/// settings.json 顶层 `settings` 是一个 **JSON 字符串**，材质在
/// `{"state":{"appearance":{"windowEffect":"..."}}}` 里；顶层并无 `windowEffect` 键
/// （那是顶层 `auth_cookie` 那种扁平 key 的写法，误用会静默回落 Mica）。
fn read_effect(handle: &tauri::AppHandle) -> Effect {
    handle
        .store("settings.json")
        .ok()
        .and_then(|store| store.get("settings"))
        .and_then(|v| v.as_str().map(str::to_owned))
        .and_then(|raw| serde_json::from_str::<Value>(&raw).ok())
        .and_then(|v| {
            v.pointer("/state/appearance/windowEffect")
                .and_then(Value::as_str)
                .map(str::to_owned)
        })
        .map_or(Effect::Mica, |name| match name.as_str() {
            "tabbed" => Effect::Tabbed,
            "acrylic" => Effect::Acrylic,
            "blur" => Effect::Blur, // 兼容历史值，当前 UI 已不再提供
            _ => Effect::Mica,
        })
}

fn apply_window_effect(handle: &tauri::AppHandle) {
    let effect = read_effect(handle);
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
