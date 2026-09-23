import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { useState } from 'react';

interface PasswordLoginProps {
  phone: string;
  setPhone: (phone: string) => void;
  loading: boolean;
  onSubmit: (password: string) => void;
}

export const PasswordLogin = ({
  phone,
  setPhone,
  loading,
  onSubmit,
}: PasswordLoginProps) => {
  const [password, setPassword] = useState('');

  const handleSubmit = (e: React.SubmitEvent) => {
    e.preventDefault();
    onSubmit(password);
  };
  return (
    <form autoComplete="off" className="space-y-4" onSubmit={handleSubmit}>
      <Input
        autoComplete="off"
        onChange={(e) => setPhone(e.target.value)}
        placeholder="手机号"
        type="text"
        value={phone}
      />
      <Input
        autoComplete="off"
        onChange={(e) => setPassword(e.target.value)}
        placeholder="密码"
        type="password"
        value={password}
      />
      <Button
        className="w-full"
        disabled={loading || !phone || !password}
        type="submit"
      >
        {loading ? '登录中...' : '登录'}
      </Button>
    </form>
  );
};
