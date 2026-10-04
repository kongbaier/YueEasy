//! 窗口能力 IPC 命令（薄壳）。命中层逻辑在 `platform::snap_layout`。

use crate::platform::snap_layout::MaximizeButtonRect;

/// 上报最大化按钮矩形（CSS 像素，相对窗口客户区左上角）：Windows 侧据此在按钮位置叠一个
/// 透明命中层子窗口（`WM_NCHITTEST` → `HTMAXBUTTON`，系统才会弹 Win11 贴靠布局浮出层）；
/// `rect` 为 `null` 表示该实例撤销（全屏 / 控件未渲染）。
///
/// `id` 标识上报者（同名控件可能有多处，见 `platform::snap_layout`）。
#[tauri::command]
pub(crate) fn set_maximize_button_rect(
    window: tauri::WebviewWindow,
    id: u64,
    rect: Option<MaximizeButtonRect>,
) -> Result<(), String> {
    crate::platform::snap_layout::set_rect(&window, id, rect)
}
