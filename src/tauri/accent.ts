// 系统强调色 infra 封装：get_accent_color 查询 + accent-color-changed 事件订阅。

import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';

export interface SystemAccentColors {
  accent: string;
  accent_dark1: string;
  accent_dark2: string;
  accent_dark3: string;
  accent_light1: string;
  accent_light2: string;
  accent_light3: string;
}

/** 查询当前系统强调色（非 Windows 或失败时 reject，调用方回退默认）。 */
export function getAccentColor(): Promise<SystemAccentColors> {
  return invoke('get_accent_color');
}

/** 订阅系统强调色变更。返回取消订阅函数。 */
export function onAccentColorChanged(
  cb: (colors: SystemAccentColors) => void,
): Promise<UnlistenFn> {
  return listen<SystemAccentColors>('accent-color-changed', (event) => {
    cb(event.payload);
  });
}
