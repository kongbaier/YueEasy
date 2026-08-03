use serde::Serialize;
use std::time::Duration;

#[derive(Debug, Clone, Serialize)]
pub struct SystemAccentColors {
    pub accent: String,
    pub accent_dark1: String,
    pub accent_dark2: String,
    pub accent_dark3: String,
    pub accent_light1: String,
    pub accent_light2: String,
    pub accent_light3: String,
}

#[cfg(target_os = "windows")]
fn read_accent_colors() -> Result<SystemAccentColors, String> {
    use windows::UI::ViewManagement::{UIColorType, UISettings};

    let settings = UISettings::new().map_err(|e| format!("failed to create UISettings: {e}"))?;

    let get = |ty: UIColorType| -> Result<String, String> {
        let c = settings
            .GetColorValue(ty)
            .map_err(|e| format!("failed to get color: {e}"))?;
        Ok(format!("#{:02x}{:02x}{:02x}", c.R, c.G, c.B))
    };

    Ok(SystemAccentColors {
        accent: get(UIColorType::Accent)?,
        accent_dark1: get(UIColorType::AccentDark1)?,
        accent_dark2: get(UIColorType::AccentDark2)?,
        accent_dark3: get(UIColorType::AccentDark3)?,
        accent_light1: get(UIColorType::AccentLight1)?,
        accent_light2: get(UIColorType::AccentLight2)?,
        accent_light3: get(UIColorType::AccentLight3)?,
    })
}

#[tauri::command]
pub fn get_accent_color() -> Result<SystemAccentColors, String> {
    #[cfg(target_os = "windows")]
    {
        read_accent_colors()
    }

    #[cfg(not(target_os = "windows"))]
    {
        Err("not supported on this platform".into())
    }
}

#[cfg(target_os = "windows")]
pub fn watch_accent_color(handle: tauri::AppHandle) {
    use tauri::Emitter;
    use windows::Foundation::TypedEventHandler;
    use windows::Win32::System::Com::{CoInitializeEx, COINIT_MULTITHREADED};
    use windows::UI::ViewManagement::UISettings;

    std::thread::spawn(move || {
        unsafe {
            let _ = CoInitializeEx(None, COINIT_MULTITHREADED);
        }

        let settings = match UISettings::new() {
            Ok(s) => s,
            Err(_) => return,
        };

        let h = handle.clone();
        let _token = settings.ColorValuesChanged(&TypedEventHandler::new(move |_, _| {
            if let Ok(colors) = read_accent_colors() {
                let _ = h.emit("accent-color-changed", colors);
            }
            Ok(())
        }));

        loop {
            std::thread::sleep(Duration::from_secs(5));
        }
    });
}

#[cfg(not(target_os = "windows"))]
pub fn watch_accent_color(_handle: tauri::AppHandle) {}
