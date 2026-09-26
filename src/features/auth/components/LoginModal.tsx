import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from '@/shared/lib/toast';
import { Button } from '@/shared/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog';
import { useAuthViewModel } from '../hooks/useAuthViewModel';
import { PasswordLogin } from './PasswordLogin';
import { QRLogin } from './QRLogin';
import { SmsLogin } from './SmsLogin';

type LoginTab = 'password' | 'sms' | 'qr';

const tabs: { key: LoginTab; label: string }[] = [
  { key: 'password', label: '密码登录' },
  { key: 'sms', label: '短信登录' },
  { key: 'qr', label: '扫码登录' },
];

export const LoginModal = () => {
  const [tab, setTab] = useState<LoginTab>('password');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const {
    loginModalOpen: open,
    setLoginModalOpen: setOpen,
    loginWithPassword,
    loginWithSms,
  } = useAuthViewModel();

  const onAuthSuccess = useCallback(
    (profile?: { nickname?: string } | null) => {
      setOpen(false);
      toast.success(`登录成功，欢迎 ${profile?.nickname || '回来'}`);
      navigate('/');
    },
    [setOpen, navigate],
  );

  const resetState = () => {
    setPhone('');
    setLoading(false);
    setError('');
    setTab('password');
  };

  const handleOpenChange = (o: boolean) => {
    setOpen(o);
    if (!o) resetState();
  };

  const handleTabChange = (newTab: LoginTab) => {
    setTab(newTab);
    setError('');
  };

  // --- Password login ---
  const handlePasswordLogin = async (password: string) => {
    setLoading(true);
    setError('');
    try {
      const profile = await loginWithPassword(phone, password);
      onAuthSuccess(profile);
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败');
    } finally {
      setLoading(false);
    }
  };

  // --- SMS login ---
  const handleSmsLogin = async (code: string) => {
    if (!code) return;
    setLoading(true);
    setError('');
    try {
      const profile = await loginWithSms(phone, code);
      onAuthSuccess(profile);
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>登录网易云音乐</DialogTitle>
        </DialogHeader>

        <div className="flex rounded-lg bg-muted p-1">
          {tabs.map((t) => (
            <Button
              className="flex-1"
              key={t.key}
              onClick={() => handleTabChange(t.key)}
              variant={tab === t.key ? 'default' : 'ghost'}
              type="button"
            >
              {t.label}
            </Button>
          ))}
        </div>

        {error && <p className="text-center text-sm text-red-500">{error}</p>}

        {tab === 'password' && (
          <PasswordLogin
            onSubmit={handlePasswordLogin}
            phone={phone}
            setPhone={setPhone}
            loading={loading}
          />
        )}

        {tab === 'sms' && (
          <SmsLogin
            phone={phone}
            setPhone={setPhone}
            loading={loading}
            onSubmit={handleSmsLogin}
          />
        )}

        {tab === 'qr' && <QRLogin onAuthSuccess={onAuthSuccess} />}
      </DialogContent>
    </Dialog>
  );
};
