import { Clock } from 'lucide-react';
import { usePageTitle } from '@/app/layout/PageTitleContext';
import { Button } from '@/shared/ui/button';
import { TrackRow, TrackRowSkeletonList } from '@/shared/components/track';
import { ScrollArea } from '@/shared/ui/scroll-area';
import { useAuthViewModel } from '@/features/auth/hooks/useAuthViewModel';
import { useScrollMemory } from '@/shared/hooks/useScrollMemory';
import { usePlayerSetting } from '@/shared/hooks/useSetting';
import { useRecentPlaysViewModel } from './hooks/useRecentPlaysViewModel';

/**
 * 最近播放页：云记录（登录）+ 本地记录（设置开关打开）综合去重。
 *
 * 取数走非 Suspense 的 useQuery（见 useRecentPlaysViewModel），因此本页是单一组件：
 * 登录门禁 / 加载骨架 / 空态全部由 early return 承载，不再用
 * `<Suspense>` + `RecentPlaysContent` 这种「为承载边界而多包一层」的模式。
 * 所有 hook（含 useScrollMemory / viewmodel）都在 early return 之前调用，
 * 保证登录态翻转时 hook 数量不变。
 */
export default function RecentPlays() {
  usePageTitle('最近播放', { root: true });
  const scrollRef = useScrollMemory();
  const { isLoggedIn, userId, openLogin } = useAuthViewModel();
  const [savePlaybackHistory] = usePlayerSetting('savePlaybackHistory');
  const { items, handlePlay, isPending } = useRecentPlaysViewModel(
    isLoggedIn ? userId : null,
    savePlaybackHistory,
  );

  // 未登录且未开启本地播放记录时才需要登录；否则可用本地记录兜底。
  if (!isLoggedIn && !savePlaybackHistory) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <Clock className="h-12 w-12 text-muted-foreground" />
        <p className="text-muted-foreground">登录后查看最近播放</p>
        <Button onClick={openLogin}>立即登录</Button>
      </div>
    );
  }

  if (isPending) {
    return (
      <div className="p-6">
        <TrackRowSkeletonList />
      </div>
    );
  }

  return (
    <ScrollArea className="h-full p-6" ref={scrollRef}>
      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-2">
          <Clock className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">还没有播放记录</p>
        </div>
      ) : (
        <div className="space-y-0.5">
          {items.map((item, index) => (
            <TrackRow
              badge={item.source === 'local' ? '本地' : undefined}
              index={index}
              key={item.song.id}
              onPlay={handlePlay}
              track={item.song}
            />
          ))}
        </div>
      )}
    </ScrollArea>
  );
}
