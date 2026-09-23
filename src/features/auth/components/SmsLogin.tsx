import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { useAuthViewModel } from '../hooks/useAuthViewModel';

interface SmsLoginProps {
  phone: string;
  setPhone: (phone: string) => void;
  loading: boolean;
  onSubmit: (code: string) => void;
}

export const SmsLogin = ({
  phone,
  setPhone,
  loading,
  onSubmit,
}: SmsLoginProps) => {
  const { sendSmsCode } = useAuthViewModel();
  const [code, setCode] = useState('');
  const [sending, setSending] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [sendError, setSendError] = useState('');

  const handleSendCode = useCallback(async () => {
    if (!phone || sending || countdown > 0) return;
    setSending(true);
    setSendError('');
    try {
      await sendSmsCode(phone);
      setCountdown(60);
    } catch (err) {
      setSendError(err instanceof Error ? err.message : '发送验证码失败');
    } finally {
      setSending(false);
    }
  }, [phone, sending, countdown, sendSmsCode]);

  // 发送验证码倒计时
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown((c) => (c <= 1 ? 0 : c - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    onSubmit(code);
  };

  return (
    <form autoComplete="off" className="space-y-4" onSubmit={handleSubmit}>
      <div className="flex gap-2">
        <Input
          autoComplete="off"
          className="flex-1"
          onChange={(e) => setPhone(e.target.value)}
          placeholder="手机号"
          type="text"
          value={phone}
        />
        <Button
          disabled={!phone || sending || countdown > 0}
          onClick={handleSendCode}
          type="button"
          variant="outline"
        >
          {sending
            ? '发送中...'
            : countdown > 0
              ? `${countdown}s`
              : '发送验证码'}
        </Button>
      </div>
      {sendError && <p className="text-sm text-red-500">{sendError}</p>}
      <Input
        autoComplete="off"
        onChange={(e) => setCode(e.target.value)}
        placeholder="验证码"
        type="text"
        value={code}
      />
      <Button
        className="w-full"
        disabled={loading || !phone || !code}
        type="submit"
      >
        {loading ? '登录中...' : '登录'}
      </Button>
    </form>
  );
};
