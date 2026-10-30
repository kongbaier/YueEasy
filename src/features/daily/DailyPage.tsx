import { Play, Sparkles } from 'lucide-react';
import { usePageTitle } from '@/app/layout/PageTitleContext';
import { Button } from '@/shared/ui/button';
import { TrackRow, TrackRowSkeleton } from '@/shared/components/track';
import { ScrollArea } from '@/shared/ui/scroll-area';
import { useAuthViewModel } from '@/features/auth/hooks/useAuthViewModel';
import { useDailyRecommendViewModel } from './hooks/useDailyRecommendViewModel';

export default function DailyRecommend() {
  usePageTitle('每日推荐', { root: true });
  const { isLoggedIn, openLogin } = useAuthViewModel();

  const { songs, handlePlay, handlePlayAll, isLoading } =
    useDailyRecommendViewModel();

  if (!isLoggedIn) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <Sparkles className="h-12 w-12 text-muted-foreground" />
        <p className="text-muted-foreground">登录后查看每日推荐</p>
        <Button onClick={openLogin}>立即登录</Button>
      </div>
    );
  }

  if (isLoading)
    return (
      <div className="p-6">
        <div className="mt-3 space-y-0.5">
          {Array.from({ length: 8 }).map((_, i) => (
            // oxlint-disable-next-line react/no-array-index-key
            <TrackRowSkeleton index={i} key={i} />
          ))}
        </div>
      </div>
    );

  return (
    <div className="py-2 h-full flex flex-col">
      <div className="px-6 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          共 <span className="text-primary px-2">{songs.length}</span>
          首推荐歌曲
        </p>
        <Button
          aria-label="播放全部"
          className="rounded-full"
          onClick={handlePlayAll}
          size="icon"
          title="播放全部"
        >
          <Play className="size-3" />
        </Button>
      </div>

      <ScrollArea className="mt-3 flex-1 px-6">
        <div className="space-y-0.5">
          {songs.map((track, index) => (
            <TrackRow
              index={index}
              key={track.id}
              onPlay={handlePlay}
              track={track}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
