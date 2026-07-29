use tauri::menu::{MenuBuilder, MenuItemBuilder};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::Manager;

pub fn setup(handle: &tauri::AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let icon_bytes = include_bytes!("../icons/32x32.png");
    let icon_img = image::load_from_memory(icon_bytes)
        .expect("failed to load tray icon")
        .to_rgba8();
    let (icon_w, icon_h) = icon_img.dimensions();
    let tray_icon = tauri::image::Image::new_owned(icon_img.into_raw(), icon_w, icon_h);

    let tray_menu = MenuBuilder::new(handle)
        .item(&MenuItemBuilder::with_id("show", "显示窗口").build(handle)?)
        .item(&MenuItemBuilder::with_id("quit", "退出").build(handle)?)
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
                let h = tray.app_handle();
                if let Some(window) = h.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.as_ref().show();
                    let _ = window.set_focus();
                }
            }
        })
        .on_menu_event(|app, event| match event.id().as_ref() {
            "show" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.as_ref().show();
                    let _ = window.set_focus();
                }
            }
            "quit" => {
                app.exit(0);
            }
            _ => {}
        })
        .build(handle)?;

    Ok(())
}
