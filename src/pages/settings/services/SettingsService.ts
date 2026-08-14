// 设置页服务（模块就近）：收敛 cache/effect/updater/app-version 的平台能力调用。
// service 层浅包 infra（@/tauri/*），hook 不再直连。

import type { Effect } from '@tauri-apps/api/window';
import { getAppVersion as tauriGetAppVersion } from '@/tauri/app';
import { cacheClearAll, cacheSize } from '@/tauri/cache';
import { setWindowEffect } from '@/tauri/effect';
import {
  checkForUpdate,
  downloadAndInstall,
  installAndRelaunch,
  type Update,
} from '@/tauri/updater';
import type { WindowsEffect } from '@/shared/types/settings';

export { type Update };

export function getCacheSize(): Promise<number> {
  return cacheSize();
}

export function clearCache(): Promise<void> {
  return cacheClearAll();
}

export function getAppVersion(): Promise<string> {
  return tauriGetAppVersion();
}

export function setEffect(effect: WindowsEffect): Promise<void> {
  return setWindowEffect(effect as unknown as Effect);
}

export function checkUpdate(): Promise<Update | null> {
  return checkForUpdate();
}

export function downloadUpdate(
  update: Update,
  onProgress?: (downloaded: number, total: number | null) => void,
): Promise<void> {
  return downloadAndInstall(update, onProgress);
}

export function relaunchApp(): Promise<void> {
  return installAndRelaunch();
}
