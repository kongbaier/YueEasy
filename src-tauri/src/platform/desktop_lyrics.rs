//! 桌面歌词窗口（`tauri.conf.json` 里声明的第二个窗口，label = `desktop-lyrics`）。
//!
//! 用**声明式窗口**而不是运行时 `WebviewWindowBuilder`：与主窗口走完全相同的
//! WebView 初始化路径（配置窗口由 Tauri 在 setup 前统一创建），避免运行时建窗出现
//! 「窗口对象存在、页面却从未 load」的僵尸状态。
//!
//! 生命周期由前端 settings（`player.desktopLyricsEnabled`）驱动：
//! 窗口随应用创建、默认隐藏，`set_enabled(true)` 只 show，`false` 只 hide（不销毁）。
//! 关闭请求（Alt+F4 等）转成 hide，并通知主窗口把开关同步为「关」——
//! 窗口可见性与设置项始终由前端一处决定。

use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::time::{Duration, Instant};

use tauri::{
    AppHandle, Emitter, LogicalPosition, LogicalSize, Manager, PhysicalPosition, PhysicalSize,
    Runtime, WebviewWindow, WindowEvent,
};

/// 桌面歌词窗口 label（前端 `@/tauri/desktopLyrics` 与 capability 都用它）。
pub const LABEL: &str = "desktop-lyrics";

/// 窗口初始尺寸（px，与 tauri.conf.json 一致）—— 只用于首帧与首次落点；
/// 真实宽高由窗口自己量好后经 `set_size` 上报（见该函数）。
const WIDTH: f64 = 960.0;
const HEIGHT: f64 = 200.0;
/// 首次出现的默认位置：主屏底部居中、距离底边这么高（逻辑 px），避免压住任务栏。
const BOTTOM_MARGIN: f64 = 120.0;
/// 锁定态「悬停揭示」事件名（与前端 `@/tauri/desktopLyrics` 一致）。
const REVEAL_EVENT: &str = "desktop-lyrics:reveal";

/// `window-state` 插件的状态文件（应用配置目录）。
const WINDOW_STATE_FILE: &str = ".window-state.json";
/// 锁定态：光标停在窗口内多久之后浮现「解锁」入口（比解锁态的 hover 长得多，防误触）。
const LOCK_REVEAL_AFTER: Duration = Duration::from_millis(1500);
/// 锁定态：光标轮询间隔。
const LOCK_WATCH_INTERVAL: Duration = Duration::from_millis(150);

#[derive(serde::Serialize, Clone)]
struct RevealPayload {
    revealed: bool,
}

/// 锁定态看门狗的代际号：每次 `set_locked` 自增，旧任务看到代际变化即退出
/// （避免「解锁后又锁上」时同时跑两个循环，互相抢 `ignore_cursor_events`）。
static LOCK_WATCH_GENERATION: AtomicU64 = AtomicU64::new(0);

/// 当前锁定态（Rust 侧镜像前端 settings，`set_locked` 是唯一写入口）。
static LOCKED: AtomicBool = AtomicBool::new(false);
/// 锁定态下「悬停揭示」是否生效。
static REVEALED: AtomicBool = AtomicBool::new(false);

/// 把 `LOCKED` / `REVEALED` 投影到窗口的鼠标穿透：**只有「锁定且未揭示」才穿透**。
///
/// 所有写这两面旗子的地方最后都调它（谁最后写谁生效），所以「解锁」不会被一个还没
/// 跑完的悬停看门狗覆盖回穿透 —— 那是「解了锁却依然点不动」的来源。
fn apply_cursor_passthrough<R: Runtime>(
    app: &AppHandle<R>,
    window: &WebviewWindow<R>,
) -> Result<(), String> {
    let locked = LOCKED.load(Ordering::SeqCst);
    let revealed = locked && REVEALED.load(Ordering::SeqCst);
    let result = window
        .set_ignore_cursor_events(locked && !revealed)
        .map_err(to_message);
    let _ = app.emit_to(LABEL, REVEAL_EVENT, RevealPayload { revealed });
    result
}

/// setup 期调用：拦截关闭（关 = 隐藏）+ 首次运行给默认落点。
pub fn setup<R: Runtime>(app: &AppHandle<R>) -> Result<(), String> {
    let Some(window) = app.get_webview_window(LABEL) else {
        return Err("desktop lyrics window missing in tauri.conf.json".into());
    };

    intercept_close(app, &window);

    // 显式把 WebView 的默认底色设成全透明。
    // 透明窗口里，只要某一刻这个默认底色变成不透明（合成层被提升/降级时会出现），
    // 整块内容就会看起来「蒙了一层」。写死成 (0,0,0,0) 把这条路径钉住。
    let _ = window.set_background_color(Some(tauri::webview::Color(0, 0, 0, 0)));

    // 有保存过的位置就交给 window-state 插件（它在窗口 ready 时已恢复），否则落到主屏底部居中
    if !has_saved_state(app) {
        place_default(&window);
    }

    Ok(())
}

/// 开启 / 关闭桌面歌词窗口（只切可见性；窗口常驻，保留前端订阅与歌词快照）。
pub fn set_enabled<R: Runtime>(app: &AppHandle<R>, enabled: bool) -> Result<(), String> {
    let Some(window) = app.get_webview_window(LABEL) else {
        return Err("desktop lyrics window is not available".into());
    };

    if enabled {
        window.show().map_err(to_message)
    } else {
        window.hide().map_err(to_message)
    }
}

/// 把窗口高度设成窗口自己量好的值（逻辑 px）。
///
/// 只换高度：**宽度由 `tauri.conf.json` 定死**（`width` = `maxWidth`，歌词区域宽度上限也在那里），
/// 不在 Web / Rust 两头重复一份尺寸真相。
///
/// Rust 侧不算任何尺寸：不留白、不夹上下限、不推导内容高度 ——
/// 歌词怎么排版（行高、间距、功能栏占位）是 Web 的事，这里只负责把量到的结果落地。
/// 保留的几何处理只有**竖向中心不动**（高度变化的一半由位置吸收）：换句 / 改字号时
/// 文字不会因为窗口长高而漂移。
///
/// 高度也用物理像素传，不经过 LogicalSize 往返换算。
pub fn set_height<R: Runtime>(app: &AppHandle<R>, height: f64) -> Result<(), String> {
    let Some(window) = app.get_webview_window(LABEL) else {
        return Ok(());
    };
    if !height.is_finite() || height < 1.0 {
        return Ok(());
    }

    let scale = window.scale_factor().map_err(to_message)?;
    let height_px = (height * scale).round().max(1.0) as u32;
    let size = window.inner_size().map_err(to_message)?;

    // 已经一样就别动窗口：观察者 ↔ 窗口尺寸来回修正是抖动的来源
    if size.height == height_px {
        return Ok(());
    }

    // 中心不动：先按差值的一半挪位置，再改高度（两次都是投递到窗口线程，顺序保持）
    if let Ok(position) = window.outer_position() {
        let dy = (height_px as i32 - size.height as i32) / 2;
        let _ = window.set_position(PhysicalPosition::new(position.x, position.y - dy));
    }

    window
        .set_size(PhysicalSize::new(size.width, height_px))
        .map_err(to_message)
}

/// 锁定 = 鼠标穿透（不挡桌面点击）+ 悬停一段时间后浮出「解锁」入口。
///
/// 穿透的窗口收不到任何鼠标事件，所以「悬停」只能由 Rust 观测：轮询系统光标，
/// 光标在窗口矩形内连续停留 `LOCK_REVEAL_AFTER` 后临时取消穿透并通知前端只显示解锁按钮；
/// 光标离开后恢复穿透。
pub fn set_locked<R: Runtime>(app: &AppHandle<R>, locked: bool) -> Result<(), String> {
    let Some(window) = app.get_webview_window(LABEL) else {
        return Ok(());
    };

    // 先写旗子再投影：即使此刻还有一个旧看门狗在跑，它也只会读到最新的锁定态。
    LOCKED.store(locked, Ordering::SeqCst);
    REVEALED.store(false, Ordering::SeqCst);

    let generation = LOCK_WATCH_GENERATION.fetch_add(1, Ordering::SeqCst) + 1;
    apply_cursor_passthrough(app, &window)?;

    if locked {
        watch_cursor_while_locked(app.clone(), generation);
    }

    Ok(())
}

/// 锁定态的悬停揭示看门狗。
fn watch_cursor_while_locked<R: Runtime>(app: AppHandle<R>, generation: u64) {
    tauri::async_runtime::spawn(async move {
        let mut inside_since: Option<Instant> = None;

        loop {
            tokio::time::sleep(LOCK_WATCH_INTERVAL).await;

            if LOCK_WATCH_GENERATION.load(Ordering::SeqCst) != generation {
                break;
            }

            let Some(window) = app.get_webview_window(LABEL) else {
                break;
            };

            // 窗口隐藏时不做任何事（保持穿透，清掉计时）
            if !window.is_visible().unwrap_or(false) {
                inside_since = None;
                if REVEALED.swap(false, Ordering::SeqCst) {
                    let _ = apply_cursor_passthrough(&app, &window);
                }
                continue;
            }

            match is_cursor_inside(&window) {
                Some(true) => {
                    let since = *inside_since.get_or_insert_with(Instant::now);
                    if !REVEALED.load(Ordering::SeqCst) && since.elapsed() >= LOCK_REVEAL_AFTER {
                        // 先放开穿透再通知前端：前端拿到揭示状态时按钮已经可点
                        REVEALED.store(true, Ordering::SeqCst);
                        let _ = apply_cursor_passthrough(&app, &window);
                    }
                }
                Some(false) => {
                    inside_since = None;
                    if REVEALED.swap(false, Ordering::SeqCst) {
                        let _ = apply_cursor_passthrough(&app, &window);
                    }
                }
                // 查询失败（窗口正在销毁等）：下一轮再试
                None => {}
            }
        }
    });
}

fn is_cursor_inside<R: Runtime>(window: &WebviewWindow<R>) -> Option<bool> {
    let origin = window.outer_position().ok()?;
    let size = window.outer_size().ok()?;
    let cursor = window.cursor_position().ok()?;

    Some(
        cursor.x >= origin.x as f64
            && cursor.y >= origin.y as f64
            && cursor.x < origin.x as f64 + size.width as f64
            && cursor.y < origin.y as f64 + size.height as f64,
    )
}

/// 关闭请求 → 隐藏 + 通知主窗口同步开关。
fn intercept_close<R: Runtime>(app: &AppHandle<R>, window: &WebviewWindow<R>) {
    let handle = app.clone();
    let w = window.clone();

    window.on_window_event(move |event| {
        if let WindowEvent::CloseRequested { api, .. } = event {
            api.prevent_close();
            let _ = w.hide();
            // 复用主窗口的 request 通道：由前端把 settings 关掉（单一真相）
            let _ = handle.emit_to(
                "main",
                "desktop-lyrics:request",
                serde_json::json!({ "action": "close" }),
            );
        }
    });
}

/// 首次出现的落点：主屏底部居中（主屏拿不到时用配置里的位置）。
fn place_default<R: Runtime>(window: &WebviewWindow<R>) {
    let Some(monitor) = window.primary_monitor().ok().flatten() else {
        return;
    };

    let scale = monitor.scale_factor();
    let LogicalSize { width, height } = monitor.size().to_logical::<f64>(scale);
    let LogicalPosition { x, y } = monitor.position().to_logical::<f64>(scale);
    let _ = window.set_position(LogicalPosition::new(
        x + (width - WIDTH) / 2.0,
        y + height - HEIGHT - BOTTOM_MARGIN,
    ));
}

/// `window-state` 插件是否已经保存过本窗口的状态（有就不要再覆盖位置）。
fn has_saved_state<R: Runtime>(app: &AppHandle<R>) -> bool {
    let Ok(dir) = app.path().app_config_dir() else {
        return false;
    };
    let Ok(raw) = std::fs::read_to_string(dir.join(WINDOW_STATE_FILE)) else {
        return false;
    };

    serde_json::from_str::<serde_json::Value>(&raw)
        .ok()
        .is_some_and(|state| state.get(LABEL).is_some())
}

fn to_message(error: tauri::Error) -> String {
    error.to_string()
}
