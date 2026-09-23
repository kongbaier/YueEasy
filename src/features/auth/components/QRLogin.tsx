import { Button } from '@/shared/ui/button';
import { CrossfadeImage } from '@/shared/ui/image';
import { useQrLogin } from '../hooks/useQrLogin';

type Profile = { nickname?: string } | null;

interface QRLoginProps {
  onAuthSuccess: (profile?: Profile) => void;
}

export const QRLogin = ({ onAuthSuccess }: QRLoginProps) => {
  const { qrImg, status, message, error, refresh } = useQrLogin(onAuthSuccess);

  return (
    <div className="flex flex-col items-center gap-3 py-2">
      {error && <p className="text-sm text-red-500">{error}</p>}
      <div className="flex h-48 w-48 items-center justify-center rounded-lg bg-muted">
        {status === 'loading' ? (
          <div className="h-full w-full animate-pulse rounded-lg bg-muted-foreground/10" />
        ) : qrImg ? (
          <CrossfadeImage alt="二维码" className="h-48 w-48" src={qrImg} />
        ) : (
          <p className="text-sm text-muted-foreground">二维码加载失败</p>
        )}
      </div>

      <p className="h-4 text-sm text-muted-foreground">{message}</p>

      <Button onClick={refresh} size="sm" type="button" variant="outline">
        刷新二维码
      </Button>
    </div>
  );
};
