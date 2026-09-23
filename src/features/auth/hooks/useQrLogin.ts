import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { QR_PHASE_MESSAGE, type QrPhase } from '../constants';
import { authService } from '../services/AuthService';

type Profile = { nickname?: string } | null;

const QR_POLL_INTERVAL_MS = 3000;
const qrImageFallback = (url: string) =>
  `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(url)}`;

export const useQrLogin = (onAuthSuccess: (profile?: Profile) => void) => {
  const [qrImg, setQrImg] = useState('');
  const [status, setStatus] = useState<QrPhase>('loading');
  const [error, setError] = useState('');
  const qrKeyRef = useRef('');
  const timerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  const stopPolling = useCallback(() => {
    clearInterval(timerRef.current);
    timerRef.current = undefined;
  }, []);

  // 定时检查扫码状态，推进流程
  const startQrFlow = useCallback(() => {
    stopPolling();
    timerRef.current = setInterval(async () => {
      const res = await authService.checkQr(qrKeyRef.current).catch(() => null);
      if (!res) return;

      if (res.status === 'expired') {
        stopPolling();
        setQrImg('');
        setStatus('expired');
      } else if (res.status === 'confirmed') {
        stopPolling();
        // 补全 profile 失败不影响已完成的登录（cookie 已落盘）
        const profile = await authService
          .fetchProfile(res.cookie ?? '')
          .catch(() => null);
        onAuthSuccess(profile);
      } else if (res.status === 'scanned' || res.status === 'waiting') {
        setStatus(res.status);
      }
    }, QR_POLL_INTERVAL_MS);
  }, [onAuthSuccess, stopPolling]);

  // 刷新二维码：重置 qrImg 并重新取码，成功后开始轮询
  const refresh = useCallback(async () => {
    stopPolling();
    setQrImg('');
    setStatus('loading');
    setError('');

    try {
      const { key } = await authService.getQrKey();
      if (!key) throw new Error('获取二维码密钥失败');
      qrKeyRef.current = key;

      const { image, url } = await authService.createQr(key);
      setQrImg(image || qrImageFallback(url));
      setStatus('waiting');
      startQrFlow();
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取二维码失败');
      setStatus('error');
    }
  }, [startQrFlow, stopPolling]);

  // 挂载即取码；卸载即停轮询。
  // queueMicrotask 避免在 effect 同步体内 setState。
  useEffect(() => {
    queueMicrotask(() => void refresh());
    return stopPolling;
  }, [refresh, stopPolling]);

  return useMemo(
    () => ({ qrImg, status, message: QR_PHASE_MESSAGE[status], error, refresh }),
    [qrImg, status, error, refresh],
  );
};
