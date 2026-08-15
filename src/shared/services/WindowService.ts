// 窗口能力服务（跨域共享）：拖拽/最大化/全屏/最小化/关闭/主题同步的窗口操作统一入口。
// 薄转发 `@/tauri/window`（infra），hooks 不再直接接触 Tauri 窗口 API。

import {
  getAppWindow as tauriGetAppWindow,
  type Window,
} from '@/tauri/window';
import type { UnlistenFn } from '@tauri-apps/api/event';

export type { Window };

export function getAppWindow(): Window {
  return tauriGetAppWindow();
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
  return getAppWindow().onScaleChanged(({ payload }) => cb(payload.scaleFactor));
}
