import { useCallback, useMemo } from 'react';
import { useSuspenseQuery } from '@tanstack/react-query';
import { getRecentSongs } from '@/services/RecentPlaysService';
import { useLoadMore } from '@/shared/hooks/useLoadMore';
import { toast } from '@/shared/lib/toast';
import type { SongRef } from '@/shared/types/playlist';
import { useQueueStore } from '@/modules/player/stores/queue';

/**
 * 最近播放页 viewmodel：组合 React Query 取数 + queue store 动作。
 * 只订阅 useQueueStore 的 play action，避免粗粒度订阅高频字段。
 * 页面组件只 import 本 hook，不直接触碰 store / service。
 */
export function useRecentPlaysViewModel(userId: number) {
  const play = useQueueStore((s) => s.play);

  const { data: tracks } = useSuspenseQuery({
    queryKey: ['recentSongs', userId],
    queryFn: () => getRecentSongs(userId),
  });

  const visibleCount = useLoadMore(tracks.length);

  const handlePlay = useCallback(
    async (track: SongRef) => {
      try {
        await play(track);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : '播放失败');
      }
    },
    [play],
  );

  return useMemo(
    () => ({ tracks, visibleCount, handlePlay }),
    [tracks, visibleCount, handlePlay],
  );
}
