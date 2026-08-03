import { Clock } from 'lucide-react';
import { Suspense } from 'react';
import { usePageTitle } from '@/app/layout/PageTitleContext';
import { Button } from '@/shared/ui/button';
import { TrackRow, TrackRowSkeleton } from '@/shared/ui/track';
import { useAuthViewModel } from '@/shared/hooks/useAuthViewModel';
import { useRecentPlaysViewModel } from './hooks/useRecentPlaysViewModel';

const RecentPlaysSkeleton = () => (
  <div className="p-6">
    <div className="space-y-0.5">
      {Array.from({ length: 8 }).map((_, i) => (
        // oxlint-disable-next-line react/no-array-index-key
        <TrackRowSkeleton index={i} key={i} />
      ))}
    </div>
  </div>
);

const RecentPlaysContent = () => {
  const { userId } = useAuthViewModel();

  if (!userId) throw new Error('未登录');

  const { tracks, visibleCount, handlePlay } = useRecentPlaysViewModel(userId);

  return (
    <div className="p-6">
      {tracks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-2">
          <Clock className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">还没有播放记录</p>
        </div>
      ) : (
        <div className="space-y-0.5">
          {tracks.slice(0, visibleCount).map((track, index) => (
            <TrackRow
              index={index}
              key={track.id}
              onPlay={handlePlay}
              track={track}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default function RecentPlays() {
  usePageTitle('最近播放', { root: true });
  const { isLoggedIn, openLogin } = useAuthViewModel();

  if (!isLoggedIn) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <Clock className="h-12 w-12 text-muted-foreground" />
        <p className="text-muted-foreground">登录后查看最近播放</p>
        <Button onClick={openLogin}>立即登录</Button>
      </div>
    );
  }

  return (
    <Suspense fallback={<RecentPlaysSkeleton />}>
      <RecentPlaysContent />
    </Suspense>
  );
}
