import { useCallback, useEffect, useState } from 'react';
import {
  checkUpdate,
  clearCache,
  downloadUpdate,
  getAppVersion,
  getCacheSize,
  relaunchApp,
  setEffect,
  type Update,
} from './services/SettingsService';
import { WindowsEffect } from '@/shared/types/settings';
import { useAuthViewModel } from '@/modules/auth/hooks/useAuthViewModel';

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

  const [cacheCount, setCacheCount] = useState<number | null>(null);
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>('idle');
  const [update, setUpdate] = useState<Update | null>(null);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [appVersion, setAppVersion] = useState('...');

  const loadCacheSize = useCallback(() => {
    getCacheSize()
      .then(setCacheCount)
      .catch(() => setCacheCount(null));
  }, []);

  useEffect(() => {
    loadCacheSize();
  }, [loadCacheSize]);

  useEffect(() => {
    getAppVersion()
      .then(setAppVersion)
      .catch(() => setAppVersion('0.0.0'));
  }, []);

  const handleClearCache = useCallback(async () => {
    await clearCache();
    setCacheCount(0);
  }, []);

  const handleEffectChange = useCallback(
    async (effect: WindowsEffect): Promise<boolean> => {
      try {
        await setEffect(effect);
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
      const u = await checkUpdate();
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
    await relaunchApp();
  }, []);

  const handleDownloadAndInstall = useCallback(async () => {
    if (!update) return;
    setUpdateStatus('downloading');
    setDownloadProgress(0);
    try {
      await downloadUpdate(update, (downloaded, total) => {
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
    cacheCount,
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
