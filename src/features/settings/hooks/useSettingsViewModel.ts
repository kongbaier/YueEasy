import { useCallback, useEffect, useState } from 'react';
import { useEffectOnActive } from 'keepalive-for-react';
import {
  checkUpdate,
  clearAudioCache,
  clearCache,
  downloadUpdate,
  getAppVersion,
  getAudioCacheDir,
  getAudioCacheStats,
  getCacheSize,
  relaunchApp,
  setEffect,
  type Update,
} from '../settings-actions-service';
import type { AudioCacheStats } from '@/shared/types/uiModels';
import type { WindowsEffect } from '@/shared/types/effect';
import { useAuthViewModel } from '@/features/auth/hooks/useAuthViewModel';

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
  const [audioCache, setAudioCache] = useState<AudioCacheStats | null>(null);
  const [audioCacheDir, setAudioCacheDir] = useState('');
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>('idle');
  const [update, setUpdate] = useState<Update | null>(null);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [appVersion, setAppVersion] = useState('...');

  const loadCacheSize = useCallback(() => {
    getCacheSize()
      .then(setCacheCount)
      .catch(() => setCacheCount(null));
  }, []);

  const loadAudioCache = useCallback(() => {
    getAudioCacheStats()
      .then(setAudioCache)
      .catch(() => setAudioCache(null));
  }, []);

  // 设置页是 KeepAlive 页：每次重新激活都刷新统计（缓存使用中随时在变）
  useEffectOnActive(() => {
    loadCacheSize();
    loadAudioCache();
    getAudioCacheDir()
      .then(setAudioCacheDir)
      .catch(() => setAudioCacheDir(''));
  }, [loadCacheSize, loadAudioCache]);

  useEffect(() => {
    loadCacheSize();
    loadAudioCache();
  }, [loadCacheSize, loadAudioCache]);

  useEffect(() => {
    getAppVersion()
      .then(setAppVersion)
      .catch(() => setAppVersion('0.0.0'));
  }, []);

  const handleClearCache = useCallback(async () => {
    await clearCache();
    setCacheCount(0);
  }, []);

  const handleClearAudioCache = useCallback(async () => {
    await clearAudioCache();
    setAudioCache({ count: 0, totalBytes: 0 });
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
    audioCache,
    audioCacheDir,
    loadAudioCache,
    handleClearAudioCache,
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
