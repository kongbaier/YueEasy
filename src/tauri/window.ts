import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow, type Window } from '@tauri-apps/api/window';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';

export type { Window };

/** 获取当前应用窗口实例（拖拽 / 最大化 / 全屏 / 主题同步等窗口操作统一入口）。 */
export function getAppWindow(): Window {
  return getCurrentWindow();
}

export function startDragging(): Promise<void> {
  return getAppWindow().startDragging();
}

export function minimize(): Promise<void> {
  return getAppWindow().minimize();
}

export function close(): Promise<void> {
  return getAppWindow().close();
}

export function hide(): Promise<void> {
  return getAppWindow().hide();
}

export function toggleMaximize(): Promise<void> {
  return getAppWindow().toggleMaximize();
}

export function maximize(): Promise<void> {
  return getAppWindow().maximize();
}

export function unmaximize(): Promise<void> {
  return getAppWindow().unmaximize();
}

export function isMaximized(): Promise<boolean> {
  return getAppWindow().isMaximized();
}

export function isFullscreen(): Promise<boolean> {
  return getAppWindow().isFullscreen();
}

export function setFullscreen(full: boolean): Promise<void> {
  return getAppWindow().setFullscreen(full);
}

export function setTheme(theme: 'light' | 'dark' | null): Promise<void> {
  return getAppWindow().setTheme(theme);
}

export function onResized(cb: () => void): Promise<UnlistenFn> {
  return getAppWindow().onResized(cb);
}

export function onThemeChanged(
  cb: (theme: 'light' | 'dark') => void,
): Promise<UnlistenFn> {
  return getAppWindow().onThemeChanged(({ payload }) => cb(payload));
}

/**
 * 监听系统缩放率变化（改系统缩放 / 拖到不同缩放副屏）。
 * JS 侧 onScaleChanged 是 Rust `WindowEvent::ScaleFactorChanged` 的桥接，语义精确，
 * 不像 window resize 那样会因窗口尺寸变化而频繁误触发。
 */
export function onScaleChanged(
  cb: (scaleFactor: number) => void,
): Promise<UnlistenFn> {
  return getAppWindow().onScaleChanged(({ payload }) =>
    cb(payload.scaleFactor),
  );
}

/** 最大化按钮矩形（CSS 像素、相对窗口客户区左上角）。 */
export type MaximizeButtonRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

/**
 * 上报最大化按钮矩形：Windows 侧据此在按钮位置叠一个透明命中层子窗口，
 * 系统拿到 `HTMAXBUTTON` 才会在悬停时弹出 Win11 贴靠布局浮出层；
 * `rect` 传 `null` 表示该实例撤销（全屏 / 控件未渲染）。其余平台为空操作。
 *
 * `id` 标识上报者：同名控件可能有多处（标题栏 / 播放页）。
 */
export function setMaximizeButtonRect(
  id: number,
  rect: MaximizeButtonRect | null,
): Promise<void> {
  return invoke('set_maximize_button_rect', { id, rect });
}

/** 悬停事件载荷：命中层归系统后 WebView 收不到该区域的鼠标消息，悬停态由原生回灌。 */
export type SnapHoverPayload = { id: number; hovering: boolean };

/**
 * 监听最大化按钮的悬停态。
 * 命中层在系统眼里是非客户区，`:hover` 不再生效，故悬停态由原生侧回灌
 * （见 Rust `platform::snap_layout`）；payload 带 `id`，调用方按自己的 id 过滤。
 */
export function onMaximizeButtonHover(
  cb: (payload: SnapHoverPayload) => void,
): Promise<UnlistenFn> {
  return listen<SnapHoverPayload>('snap-layout-hover', ({ payload }) =>
    cb(payload),
  );
}
