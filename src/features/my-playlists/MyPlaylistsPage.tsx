import { Library } from 'lucide-react';
import { usePageTitle } from '@/app/layout/PageTitleContext';
import { Button } from '@/shared/ui/button';
import { PlaylistCard } from '@/shared/components/playlist-card';
import { Skeleton } from '@/shared/ui/skeleton';
import { ScrollArea } from '@/shared/ui/scroll-area';
import { useAuthViewModel } from '@/features/auth/hooks/useAuthViewModel';
import { useScrollMemory } from '@/shared/hooks/useScrollMemory';
import type { Playlist } from '@/shared/types/uiModels';
import { useMyPlaylistsViewModel } from './hooks/useMyPlaylistsViewModel';

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

/** 单卡骨架：与 PlaylistCard 同尺寸（w-42/lg:w-44/xl:w-48 + m-1 + 方形封面 + 两行文字）。 */
const PlaylistCardSkeleton = () => (
  <div className="w-42 shrink-0 box-content m-1 lg:w-44 xl:w-48">
    <Skeleton className="aspect-square w-full rounded-lg" shimmer />
    <div className="pt-2.5 space-y-1.5">
      <Skeleton className="h-3.5 w-4/5" shimmer />
      <Skeleton className="h-3 w-2/5" shimmer />
    </div>
  </div>
);

const SECTIONS = ['创建的歌单', '收藏的歌单'];

export default function MyPlaylists() {
  usePageTitle('我的歌单', { root: true });
  const { userId, openLogin } = useAuthViewModel();
  const scrollRef = useScrollMemory();

  const { created, favorited, isLoading } = useMyPlaylistsViewModel(userId);

  if (userId == null) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <Library className="h-12 w-12 text-muted-foreground" />
        <p className="text-muted-foreground">登录后查看我的歌单</p>
        <Button onClick={openLogin}>立即登录</Button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <ScrollArea className="h-full p-6">
        <div className="space-y-8">
          {SECTIONS.map((title) => (
            <section key={title}>
              <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
              <div className="mt-3 flex flex-wrap gap-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  // oxlint-disable-next-line react/no-array-index-key
                  <PlaylistCardSkeleton key={i} />
                ))}
              </div>
            </section>
          ))}
        </div>
      </ScrollArea>
    );
  }

  if (created.length === 0 && favorited.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-2">
        <Library className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">暂无歌单</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full p-6" ref={scrollRef}>
      <div className="space-y-8">
        <Section title="创建的歌单" playlists={created} />
        <Section title="收藏的歌单" playlists={favorited} />
      </div>
    </ScrollArea>
  );
}
