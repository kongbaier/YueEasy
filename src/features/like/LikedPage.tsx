import { useEffectOnActive } from 'keepalive-for-react';
import { Heart } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { usePageTitle } from '@/app/layout/PageTitleContext';
import { Button } from '@/shared/ui/button';
import { useAuthViewModel } from '../auth/hooks/useAuthViewModel';
import { useLikeStore } from './stores/like';

export default function LikedPage() {
  usePageTitle('我的喜欢', { root: true });
  const { isLoggedIn, openLogin } = useAuthViewModel();
  const likedPlaylistId = useLikeStore((s) => s.likedPlaylistId);
  const navigate = useNavigate();

  useEffectOnActive(() => {
    if (likedPlaylistId) {
      navigate(`/my/liked/${likedPlaylistId}`, { replace: true });
    }
  }, [likedPlaylistId, navigate]);

  if (!isLoggedIn) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <Heart className="h-12 w-12 text-muted-foreground" />
        <p className="text-muted-foreground">登录后查看我喜欢</p>
        <Button onClick={openLogin}>立即登录</Button>
      </div>
    );
  }

  return null;
}
