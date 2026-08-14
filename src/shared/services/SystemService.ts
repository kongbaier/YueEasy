// 系统级服务（跨域共享）：强调色查询与变更订阅。
// 薄转发 `@/tauri/accent`（infra），供 useAccentColor 等跨域 hook 使用。

import {
  getAccentColor as tauriGetAccentColor,
  onAccentColorChanged as tauriOnAccentColorChanged,
  type SystemAccentColors,
} from '@/tauri/accent';
import type { UnlistenFn } from '@tauri-apps/api/event';

export type { SystemAccentColors };

export function getAccentColor(): Promise<SystemAccentColors> {
  return tauriGetAccentColor();
}

export function subscribeAccentColor(
  cb: (colors: SystemAccentColors) => void,
): Promise<UnlistenFn> {
  return tauriOnAccentColorChanged(cb);
}
