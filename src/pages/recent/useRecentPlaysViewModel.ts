import { useCallback, useEffect, useMemo } from 'react';
import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { getCombinedRecent } from './RecentPlaysService';
import { useLoadMore } from '@/shared/hooks/useLoadMore';
import { toast } from '@/shared/lib/toast';
import type { Song } from '@/shared/types/entities';
import { playerService } from '@/modules/player/services/PlayerService';
import { onLocalHistoryChanged } from '@/modules/player/services/PlayHistoryService';

/**
 * 最近播放页 viewmodel：组合 React Query 取数（云+本地综合）+ queue store 动作。
 * userId 为空时仅取本地记录；localEnabled 控制本地来源是否并入。
 * 订阅本地播放记录变更事件，播放后实时失效综合查询（后台重取）。
 * 页面组件只 import 本 hook，不直接触碰 store / service。
 */
export function useRecentPlaysViewModel(
  userId: number | null,
  localEnabled: boolean,
) {
  const play = playerService.play;
  const queryClient = useQueryClient();

  const { data: items } = useSuspenseQuery({
    queryKey: ['recentSongs', userId, localEnabled],
    queryFn: () => getCombinedRecent(userId, localEnabled),
  });

  // 本地记录变化（有新的播放落库）→ 失效综合查询，后台重取实现实时更新。
  useEffect(() => {
    return onLocalHistoryChanged(() => {
      void queryClient.invalidateQueries({ queryKey: ['recentSongs'] });
    });
  }, [queryClient]);

  const visibleCount = useLoadMore(items.length);

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

  return useMemo(
    () => ({ items, visibleCount, handlePlay }),
    [items, visibleCount, handlePlay],
  );
}
