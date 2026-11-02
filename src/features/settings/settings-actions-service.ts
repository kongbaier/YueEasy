import { getAppVersion as tauriGetAppVersion } from '@/tauri/app';
import { cacheClearAll, cacheSize } from '@/tauri/cache';
import type { AudioCacheStats } from '@/shared/types/uiModels';
import {
  clear as clearAudioCacheFiles,
  getCacheDir as getAudioCacheDirFromService,
  getStats as getAudioCacheStatsFromService,
} from '@/features/player/services/AudioCacheService';
import type { WindowsEffect } from '@/shared/types/effect';
import { setWindowsEffect } from '@/tauri/effect';
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

// ── 音频文件缓存（磁盘；与上面的 plugin 数据缓存分开计） ──

export function getAudioCacheStats(): Promise<AudioCacheStats> {
  return getAudioCacheStatsFromService();
}

export function getAudioCacheDir(): Promise<string> {
  return getAudioCacheDirFromService();
}

export function clearAudioCache(): Promise<void> {
  return clearAudioCacheFiles();
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
