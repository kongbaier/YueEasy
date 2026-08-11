import { useCallback, useMemo } from 'react';
import { useSuspenseQuery } from '@tanstack/react-query';
import { getDailyRecommendSongs } from './DailyRecommendService';
import { useLoadMore } from '@/shared/hooks/useLoadMore';
import { toast } from '@/shared/lib/toast';
import type { Song } from '@/shared/types/entities';
import { useQueueStore } from '@/modules/player/stores/queue';

/**
 * 每日推荐页 viewmodel：组合 React Query 取数 + queue store 动作。
 * 只订阅 useQueueStore 的 play / replaceAndPlay 两个 action，避免粗粒度订阅高频字段。
 * 页面组件只 import 本 hook，不直接触碰 store / service。
 */
export function useDailyRecommendViewModel() {
  const play = useQueueStore((s) => s.play);
  const replaceAndPlay = useQueueStore((s) => s.replaceAndPlay);

  const { data: songs } = useSuspenseQuery({
    queryKey: ['dailyRecommend'],
    queryFn: () => getDailyRecommendSongs(),
    staleTime: 5 * 60 * 1000,
  });

  const visibleCount = useLoadMore(songs.length);

  const handlePlay = useCallback(
    async (track: Song) => {
      try {
        await play(track);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : '播放失败');
      }
    },
    [play],
  );

  const handlePlayAll = useCallback(async () => {
    if (!songs.length) return;
    try {
      await replaceAndPlay(songs);
    } catch {
      toast.error('没有可播放的歌曲');
    }
  }, [replaceAndPlay, songs]);

  return useMemo(
    () => ({ songs, visibleCount, handlePlay, handlePlayAll }),
    [songs, visibleCount, handlePlay, handlePlayAll],
  );
}