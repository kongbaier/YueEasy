import { getVersion } from '@tauri-apps/api/app';
import { Effect } from '@tauri-apps/api/window';
import { useCallback, useEffect, useState } from 'react';
import { cacheClearAll, cacheSize } from '@/tauri/cache';
import { setWindowEffect } from '@/tauri/effect';
import { WindowsEffect } from '@/shared/types/settings';
import { useAuthViewModel } from './useAuthViewModel';
import {
  checkForUpdate,
  downloadAndInstall,
  installAndRelaunch,
  type Update,
} from '@/tauri/updater';

type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'up-to-date'
  | 'available'
  | 'downloading'
  | 'installing'
  | 'error';

export function useSettingsViewModel() {
  const { isLoggedIn, nickname, avatarUrl, userId, logout, openLogin } =
    useAuthViewModel();

  const [cacheBytes, setCacheBytes] = useState<number | null>(null);
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>('idle');
  const [update, setUpdate] = useState<Update | null>(null);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [appVersion, setAppVersion] = useState('...');

  const loadCacheSize = useCallback(() => {
    cacheSize()
      .then(setCacheBytes)
      .catch(() => setCacheBytes(null));
  }, []);

  useEffect(() => {
    loadCacheSize();
  }, [loadCacheSize]);

  useEffect(() => {
    getVersion()
      .then(setAppVersion)
      .catch(() => setAppVersion('0.0.0'));
  }, []);

  const handleClearCache = useCallback(async () => {
    await cacheClearAll();
    setCacheBytes(0);
  }, []);

  const handleEffectChange = useCallback(
    async (effect: WindowsEffect): Promise<boolean> => {
      try {
        await setWindowEffect(effect as unknown as Effect);
        return true;
      } catch {
        return false;
      }
    },
    [],
  );

  const handleCheckUpdate = useCallback(async () => {
    setUpdateStatus('checking');
    try {
      const u = await checkForUpdate();
      if (u) {
        setUpdate(u);
        setUpdateStatus('available');
      } else {
        setUpdateStatus('up-to-date');
      }
    } catch (e) {
      setUpdateStatus('error');
      throw e;
    }
  }, []);

  const handleInstallAndRelaunch = useCallback(async () => {
    await installAndRelaunch();
  }, []);

  const handleDownloadAndInstall = useCallback(async () => {
    if (!update) return;
    setUpdateStatus('downloading');
    setDownloadProgress(0);
    try {
      await downloadAndInstall(update, (downloaded, total) => {
        if (total) {
          setDownloadProgress(Math.round((downloaded / total) * 100));
        }
      });
      setUpdateStatus('installing');
      await handleInstallAndRelaunch();
    } catch (e) {
      setUpdateStatus('available');
      throw e;
    }
  }, [update, handleInstallAndRelaunch]);

  return {
    isLoggedIn,
    nickname,
    avatarUrl,
    userId,
    logout,
    openLogin,
    cacheBytes,
    loadCacheSize,
    handleClearCache,
    updateStatus,
    update,
    downloadProgress,
    handleCheckUpdate,
    handleDownloadAndInstall,
    handleInstallAndRelaunch,
    appVersion,
    handleEffectChange,
  };
}
