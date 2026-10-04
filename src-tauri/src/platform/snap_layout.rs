//! Windows 11「贴靠布局」（Snap Layouts）命中区。
//!
//! **为什么是在最大化按钮上叠一个透明子窗口，而不是给顶层窗口装 `WM_NCHITTEST` 子类：**
//!
//! 1. 系统只在「鼠标底下那个窗口」的 `WM_NCHITTEST` 返回 `HTMAXBUTTON` 时才弹贴靠布局浮出层；
//! 2. `decorations: false` 时主窗口客户区被一层层子窗口盖满：tauri-runtime-wry 的
//!    `TAURI_DRAG_RESIZE_BORDERS`（缩放边条，它靠 *自己的* `WM_NCHITTEST` 才让无边框窗口能拖边缩放）
//!    + WebView2 的 `Chrome_WidgetWin_*` / renderer 子窗口。真正被命中的是这些子窗口，
//!    给顶层窗口返回 `HTMAXBUTTON` **根本轮不到系统来问**（可直接验证：顶层返回 9，而实际悬停无效）；
//! 3. 因此照抄那条被验证过的路子：在按钮位置叠一个 1:1 的透明子窗口，它的 `WM_NCHITTEST`
//!    恒返回 `HTMAXBUTTON`。系统命中的就是它 → 弹浮出层；点击也由它接管
//!    （命中区在系统眼里是非客户区，WebView 收不到该区域的鼠标消息）。
//!
//! 由此带来的副作用，本模块与 `useMaximizeButtonSnap` 一并兜住：
//! - 覆盖层归系统后 `:hover` 亮不了 → 悬停态经 `snap-layout-hover` 事件回灌前端补样式；
//! - 覆盖层不画任何东西（类画刷为 NULL），只做命中，不影响按钮外观。
//!
//! 坐标系：前端上报 CSS 像素（相对客户区左上角），这里按当前 DPI 换算成物理像素，
//! 覆盖层与按钮在物理像素上对齐 → 缩放 / 多屏变化只需前端重报一次。

use serde::{Deserialize, Serialize};

/// 原生 → 前端的悬停态事件名（payload: [`HoverPayload`]）。
pub const HOVER_EVENT: &str = "snap-layout-hover";

/// 前端上报的最大化按钮矩形：CSS 像素、相对窗口客户区左上角。
#[derive(Debug, Clone, Copy, PartialEq, Deserialize)]
pub struct MaximizeButtonRect {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

/// 悬停事件载荷。
///
/// 带 `id` 是因为同一窗口可能有多处 `WindowControls`（AppHeader / 播放页），
/// 前端只认自己那份，避免高亮串台。
#[derive(Debug, Clone, Copy, Serialize)]
pub struct HoverPayload {
    pub id: u64,
    pub hovering: bool,
}

/// 为某个控件实例创建/移动/销毁命中覆盖层；`rect` 为 `None` 表示撤销。
#[cfg(target_os = "windows")]
pub fn set_rect(
    window: &tauri::WebviewWindow,
    id: u64,
    rect: Option<MaximizeButtonRect>,
) -> Result<(), String> {
    windows_impl::set_rect(window, id, rect)
}

#[cfg(not(target_os = "windows"))]
pub fn set_rect(
    _window: &tauri::WebviewWindow,
    _id: u64,
    _rect: Option<MaximizeButtonRect>,
) -> Result<(), String> {
    Ok(())
}

#[cfg(target_os = "windows")]
mod windows_impl {
    use super::{HoverPayload, MaximizeButtonRect, HOVER_EVENT};
    use std::sync::{Mutex, MutexGuard, OnceLock};
    use tauri::{AppHandle, Emitter, Manager, WebviewWindow};
    use windows::core::{w, PCWSTR};
    use windows::Win32::Foundation::{HINSTANCE, HWND, LPARAM, LRESULT, WPARAM};
    use windows::Win32::Graphics::Gdi::HBRUSH;
    use windows::Win32::System::LibraryLoader::GetModuleHandleW;
    use windows::Win32::UI::HiDpi::GetDpiForWindow;
    use windows::Win32::UI::Input::KeyboardAndMouse::{
        TrackMouseEvent, TRACKMOUSEEVENT, TRACKMOUSEEVENT_FLAGS, TME_LEAVE, TME_NONCLIENT,
    };
    use windows::Win32::UI::WindowsAndMessaging::{
        CreateWindowExW, DefWindowProcW, DestroyWindow, GetWindowLongPtrW, HMENU, IsWindow,
        IsZoomed, LoadCursorW, PostMessageW, RegisterClassExW, SetCursor, SetWindowLongPtrW, SetWindowPos,
        CREATESTRUCTW, GWLP_USERDATA, HCURSOR, HICON, HTMAXBUTTON, HWND_TOP, IDC_ARROW,
        SC_MAXIMIZE, SC_RESTORE, SWP_NOACTIVATE, SWP_NOMOVE, SWP_NOSIZE, WINDOW_EX_STYLE, WM_NCCREATE,
        WM_NCDESTROY, WM_NCHITTEST, WM_NCLBUTTONDOWN, WM_NCLBUTTONUP, WM_NCMOUSELEAVE,
        WM_SETCURSOR, WM_SYSCOMMAND, WNDCLASSEXW, WNDCLASS_STYLES, WS_CHILD, WS_VISIBLE,
    };

    const CLASS_NAME: PCWSTR = w!("YueEasySnapOverlay");

    /// 覆盖层状态：挂在子窗口的 `GWLP_USERDATA` 上（窗口销毁时回收）。
    struct Overlay {
        id: u64,
        parent: HWND,
        app: AppHandle,
        hovering: bool,
    }

    /// 已建的覆盖层 `(id, parent, child)`。
    ///
    /// 存 `isize` 而非 `HWND`：`HWND` 是裸指针、不是 `Send`，而静态量与
    /// `run_on_main_thread` 的闭包都要求 `Send`（句柄只在主线程里还原使用）。
    static OVERLAYS: Mutex<Vec<(u64, isize, isize)>> = Mutex::new(Vec::new());
    static CLASS_REGISTERED: OnceLock<()> = OnceLock::new();

    pub(super) fn set_rect(
        window: &WebviewWindow,
        id: u64,
        rect: Option<MaximizeButtonRect>,
    ) -> Result<(), String> {
        // 注意：tauri 依赖 windows 0.61、本 crate 是 0.58，句柄只能过一层裸指针搬过来。
        let parent = window.hwnd().map_err(|e| e.to_string())?.0 as isize;
        let app = window.app_handle().clone();

        // 建窗 / 移窗都必须在主线程（也是窗口所属线程）。
        window
            .run_on_main_thread(move || {
                let parent = HWND(parent as *mut core::ffi::c_void);
                if !unsafe { IsWindow(parent).as_bool() } {
                    return;
                }

                match rect {
                    Some(rect) => upsert(app, id, parent, rect),
                    None => remove(id, Some(&app)),
                }
            })
            .map_err(|e| e.to_string())
    }

    fn upsert(app: AppHandle, id: u64, parent: HWND, rect: MaximizeButtonRect) {
        let scale = unsafe { GetDpiForWindow(parent) } as f64 / 96.0;
        let (x, y, width, height) = (
            (rect.x * scale).round() as i32,
            (rect.y * scale).round() as i32,
            (rect.width * scale).round() as i32,
            (rect.height * scale).round() as i32,
        );

        if let Some(child) = child_of(id) {
            // 窗口可能被销毁过（例如 tao 重建了窗口）：句柄失效就重新走一遍建窗流程。
            if unsafe { IsWindow(child).as_bool() } {
                // hWndInsertAfter = HWND_TOP 且不带 SWP_NOZORDER：每次都把命中层顶到子窗口 Z 序最上面。
                // 必要：CreateWindowExW 建出来的子窗口可能在 WebView 子窗口之下（那样鼠标永远命不中它），
                // 而且 tauri 的缩放边条会在 WM_SIZE 时把自己的子窗口重新顶到最上。
                let _ = unsafe {
                    SetWindowPos(
                        child,
                        HWND_TOP,
                        x,
                        y,
                        width,
                        height,
                        SWP_NOACTIVATE,
                    )
                };
                return;
            }
            lock_overlays().retain(|(_, _, handle)| *handle != child.0 as isize);
        }

        register_class();
        let state = Box::new(Overlay {
            id,
            parent,
            app,
            hovering: false,
        });

        let child = unsafe {
            CreateWindowExW(
                WINDOW_EX_STYLE::default(),
                CLASS_NAME,
                w!(""),
                WS_CHILD | WS_VISIBLE,
                x,
                y,
                width,
                height,
                parent,
                HMENU::default(),
                module_instance(),
                Some(Box::into_raw(state) as *const core::ffi::c_void),
            )
        };

        match child {
            Ok(child) => {
                // 建出来先顶到最上层，不必等下一次上报。
                let _ = unsafe {
                    SetWindowPos(
                        child,
                        HWND_TOP,
                        0,
                        0,
                        0,
                        0,
                        SWP_NOACTIVATE | SWP_NOMOVE | SWP_NOSIZE,
                    )
                };
                lock_overlays().push((id, parent.0 as isize, child.0 as isize));
            }
            Err(e) => log::warn!("snap overlay CreateWindowExW failed: {e}"),
        }
    }

    fn remove(id: u64, app: Option<&AppHandle>) {
        let removed = {
            let mut overlays = lock_overlays();
            overlays
                .iter()
                .position(|(owner, _, _)| *owner == id)
                .map(|pos| overlays.remove(pos))
        };

        let Some((_, _, child)) = removed else {
            return;
        };

        if let Some(app) = app {
            // 覆盖层没了，前端那份 hover 高亮也要跟着收掉。
            let _ = app.emit(
                HOVER_EVENT,
                HoverPayload {
                    id,
                    hovering: false,
                },
            );
        }

        // 必须在放锁之后再销毁：DestroyWindow 会同步回调 WM_NCDESTROY，那里还会读一次登记表。
        let _ = unsafe { DestroyWindow(HWND(child as *mut core::ffi::c_void)) };
    }

    fn child_of(id: u64) -> Option<HWND> {
        lock_overlays()
            .iter()
            .find(|(owner, _, _)| *owner == id)
            .map(|(_, _, child)| HWND(*child as *mut core::ffi::c_void))
    }

    fn lock_overlays() -> MutexGuard<'static, Vec<(u64, isize, isize)>> {
        OVERLAYS.lock().unwrap_or_else(|e| e.into_inner())
    }

    fn register_class() {
        CLASS_REGISTERED.get_or_init(|| {
            let class = WNDCLASSEXW {
                cbSize: std::mem::size_of::<WNDCLASSEXW>() as u32,
                style: WNDCLASS_STYLES::default(),
                lpfnWndProc: Some(overlay_proc),
                cbClsExtra: 0,
                cbWndExtra: 0,
                hInstance: module_instance(),
                hIcon: HICON::default(),
                hCursor: HCURSOR::default(),
                // NULL 画刷 → 不擦背景、不绘制，覆盖层完全透明。
                hbrBackground: HBRUSH::default(),
                lpszMenuName: PCWSTR::null(),
                lpszClassName: CLASS_NAME,
                hIconSm: HICON::default(),
            };
            unsafe { RegisterClassExW(&class) };
        });
    }

    fn module_instance() -> HINSTANCE {
        unsafe { GetModuleHandleW(PCWSTR::null()) }
            .map(Into::into)
            .unwrap_or_default()
    }

    unsafe extern "system" fn overlay_proc(
        hwnd: HWND,
        msg: u32,
        wparam: WPARAM,
        lparam: LPARAM,
    ) -> LRESULT {
        match msg {
            WM_NCCREATE => {
                let params = lparam.0 as *const CREATESTRUCTW;
                SetWindowLongPtrW(hwnd, GWLP_USERDATA, (*params).lpCreateParams as isize);
            }
            // 覆盖层正好压在按钮上 → 这里的任何一点都是「最大化按钮」。
            WM_NCHITTEST => {
                set_hover(hwnd, true);
                return LRESULT(HTMAXBUTTON as _);
            }
            WM_NCMOUSELEAVE => set_hover(hwnd, false),
            // 命中的是非客户区：鼠标消息不会进 WebView，点击自己接掉。
            // （鼠标按下时系统已隐式捕获，抬起那一下必回本窗口。）
            WM_NCLBUTTONDOWN if wparam.0 == HTMAXBUTTON as usize => return LRESULT(0),
            WM_NCLBUTTONUP if wparam.0 == HTMAXBUTTON as usize => {
                if let Some(state) = state_mut(hwnd) {
                    // 走系统标准最大化/还原：位置还原、动画、任务栏避让、tao 的 WM_SIZE 通知都归它管。
                    // Post 而非 Send，避免在窗口过程里重入。
                    let cmd = if IsZoomed(state.parent).as_bool() {
                        SC_RESTORE
                    } else {
                        SC_MAXIMIZE
                    };
                    let _ = PostMessageW(
                        state.parent,
                        WM_SYSCOMMAND,
                        WPARAM(cmd as usize),
                        LPARAM(0),
                    );
                }
                return LRESULT(0);
            }
            // 本身不画东西，只把光标定成箭头（免得从上方缩放边条滑下来还留着 SIZENS）。
            WM_SETCURSOR => {
                let _ = SetCursor(LoadCursorW(HINSTANCE::default(), IDC_ARROW).unwrap_or_default());
                return LRESULT(1);
            }
            WM_NCDESTROY => {
                lock_overlays().retain(|(_, _, child)| *child != hwnd.0 as isize);

                let state = GetWindowLongPtrW(hwnd, GWLP_USERDATA) as *mut Overlay;
                SetWindowLongPtrW(hwnd, GWLP_USERDATA, 0);
                if !state.is_null() {
                    drop(Box::from_raw(state));
                }
            }
            _ => {}
        }

        DefWindowProcW(hwnd, msg, wparam, lparam)
    }

    unsafe fn state_mut(hwnd: HWND) -> Option<&'static mut Overlay> {
        (GetWindowLongPtrW(hwnd, GWLP_USERDATA) as *mut Overlay).as_mut()
    }

    unsafe fn set_hover(hwnd: HWND, hovering: bool) {
        let Some(state) = state_mut(hwnd) else {
            return;
        };
        if state.hovering == hovering {
            return;
        }
        state.hovering = hovering;

        if hovering {
            // 覆盖层只有按钮那么大，指针移出后不会再收到 WM_NCHITTEST → 用 TrackMouseEvent 换一次
            // WM_NCMOUSELEAVE，好把高亮收掉。
            let mut track = TRACKMOUSEEVENT {
                cbSize: std::mem::size_of::<TRACKMOUSEEVENT>() as u32,
                dwFlags: TRACKMOUSEEVENT_FLAGS(TME_LEAVE.0 | TME_NONCLIENT.0),
                hwndTrack: hwnd,
                dwHoverTime: 0,
            };
            let _ = TrackMouseEvent(&mut track);
        }

        let _ = state.app.emit(
            HOVER_EVENT,
            HoverPayload {
                id: state.id,
                hovering,
            },
        );
    }
}
