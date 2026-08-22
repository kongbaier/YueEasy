import { Library } from 'lucide-react';
import { Suspense } from 'react';
import { usePageTitle } from '@/app/layout/PageTitleContext';
import { Button } from '@/shared/ui/button';
import { PlaylistCard } from '@/shared/ui/playlist-card';
import { useAuthViewModel } from '@/modules/auth/hooks/useAuthViewModel';
import type { Playlist } from '@/shared/types/entities';
import { useMyPlaylistsViewModel } from './useMyPlaylistsViewModel';

const Section = ({
  title,
  playlists,
}: {
  title: string;
  playlists: Playlist[];
}) => {
  if (playlists.length === 0) return null;
  return (
    <section>
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      <div className="mt-3 flex flex-wrap gap-4">
        {playlists.map((pl) => (
          <PlaylistCard key={pl.id} playlist={pl} />
        ))}
      </div>
    </section>
  );
};

const MyPlaylistsContent = () => {
  const { userId } = useAuthViewModel();
  if (!userId) throw new Error('未登录');

  const { created, favorited } = useMyPlaylistsViewModel(userId);

  if (created.length === 0 && favorited.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-2">
        <Library className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">暂无歌单</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8">
      <Section title="创建的歌单" playlists={created} />
      <Section title="收藏的歌单" playlists={favorited} />
    </div>
  );
};

export default function MyPlaylists() {
  usePageTitle('我的歌单', { root: true });
  const { isLoggedIn, openLogin } = useAuthViewModel();

  if (!isLoggedIn) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <Library className="h-12 w-12 text-muted-foreground" />
        <p className="text-muted-foreground">登录后查看我的歌单</p>
        <Button onClick={openLogin}>立即登录</Button>
      </div>
    );
  }

  return (
    <Suspense fallback={null}>
      <MyPlaylistsContent />
    </Suspense>
  );
}
