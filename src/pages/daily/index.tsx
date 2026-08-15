import { Play, Sparkles } from 'lucide-react';
import { Suspense } from 'react';
import { usePageTitle } from '@/app/layout/PageTitleContext';
import { Button } from '@/shared/ui/button';
import { TrackRow, TrackRowSkeleton } from '@/shared/ui/track';
import { useAuthViewModel } from '@/modules/auth/hooks/useAuthViewModel';
import { useDailyRecommendViewModel } from './useDailyRecommendViewModel';

const DailyRecommendSkeleton = () => (
  <div className="p-6">
    <div className="mt-3 space-y-0.5">
      {Array.from({ length: 8 }).map((_, i) => (
        // oxlint-disable-next-line react/no-array-index-key
        <TrackRowSkeleton index={i} key={i} />
      ))}
    </div>
  </div>
);

const DailyRecommendContent = () => {
  const { songs, visibleCount, handlePlay, handlePlayAll } =
    useDailyRecommendViewModel();

  return (
    <div className="p-6">
      {songs.length > 0 ? (
        <>
          <div className="mt-4 flex items-center gap-3">
            <p className="text-sm text-muted-foreground">
              共 {songs.length} 首推荐歌曲
            </p>
            <Button onClick={handlePlayAll} size="xs">
              <Play className="h-3 w-3" />
              播放全部
            </Button>
          </div>

          <div className="mt-3 space-y-0.5">
            {songs.slice(0, visibleCount).map((track, index) => (
              <TrackRow
                index={index}
                key={track.id}
                onPlay={handlePlay}
                track={track}
              />
            ))}
          </div>
        </>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">暂无推荐歌曲</p>
      )}
    </div>
  );
};

export default function DailyRecommend() {
  usePageTitle('每日推荐', { root: true });
  const { isLoggedIn, openLogin } = useAuthViewModel();

  if (!isLoggedIn) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <Sparkles className="h-12 w-12 text-muted-foreground" />
        <p className="text-muted-foreground">登录后查看每日推荐</p>
        <Button onClick={openLogin}>立即登录</Button>
      </div>
    );
  }

  return (
    <Suspense fallback={<DailyRecommendSkeleton />}>
      <DailyRecommendContent />
    </Suspense>
  );
}
