// 窗口能力 infra 封装：统一获取当前窗口实例（hooks 不再直接 import @tauri-apps/api/window）。

import { getCurrentWindow, type Window } from '@tauri-apps/api/window';

export type { Window } from '@tauri-apps/api/window';

/** 获取当前应用窗口实例（拖拽 / 最大化 / 全屏 / 主题同步等窗口操作统一入口）。 */
export function getAppWindow(): Window {
  return getCurrentWindow();
}
