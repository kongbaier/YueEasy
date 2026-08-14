import { Heart } from 'lucide-react';
import { usePageTitle } from '@/app/layout/PageTitleContext';
import { Button } from '@/shared/ui/button';
import Playlist from '@/pages/playlist';
import { useAuthViewModel } from '@/modules/auth/hooks/useAuthViewModel';
import { useLikeStore } from '@/modules/like/stores/like';

/**
 * 我喜欢的歌曲页：仅作登录守卫，内部直接复用 Playlist 组件。
 * 「我喜欢」是网易云内置歌单（specialType === 5），其 id 登录后由 like store 同步获取。
 */
export default function LikedSongs() {
  usePageTitle('我的喜欢', { root: true });
  const { isLoggedIn, openLogin } = useAuthViewModel();
  const likedPlaylistId = useLikeStore((s) => s.likedPlaylistId);

  if (!isLoggedIn) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <Heart className="h-12 w-12 text-muted-foreground" />
        <p className="text-muted-foreground">登录后查看我喜欢</p>
        <Button onClick={openLogin}>立即登录</Button>
      </div>
    );
  }

  if (!likedPlaylistId) return null;

  return <Playlist playlistId={likedPlaylistId} />;
}