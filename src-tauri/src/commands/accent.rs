//! 系统强调色 IPC 命令（薄壳）。OS 读取逻辑在 `platform::accent_color`。

use crate::platform::accent_color::SystemAccentColors;

#[tauri::command]
pub(crate) fn get_accent_color() -> Result<SystemAccentColors, String> {
    #[cfg(target_os = "windows")]
    {
        crate::platform::accent_color::read_accent_colors()
    }

    #[cfg(not(target_os = "windows"))]
    {
        Err("not supported on this platform".into())
    }
}
