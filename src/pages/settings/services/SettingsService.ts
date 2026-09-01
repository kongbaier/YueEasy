import { getAppVersion as tauriGetAppVersion } from '@/tauri/app';
import { cacheClearAll, cacheSize } from '@/tauri/cache';
import type { WindowsEffect } from "@/shared/types/effect";
import { setWindowsEffect } from "@/tauri/effect";
import {
  checkForUpdate,
  downloadAndInstall,
  installAndRelaunch,
  type Update,
} from '@/tauri/updater';

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
  return setWindowsEffect(effect);
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
