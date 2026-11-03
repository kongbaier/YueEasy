import { useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffectOnActive } from 'keepalive-for-react';
import { getRecentSongs } from '../recent-service';
import { toast } from '@/shared/lib/toast';
import { reportError } from '@/shared/utils/error';
import type { Song } from '@/shared/types/uiModels';
import { playerService } from '@/features/player/services/PlayerService';

/**
 * 最近播放页 viewmodel：React Query 取云端「最近听过」+ playerService 命令。
 *
 * 取数走非 Suspense 的 `useQuery`（页面自身不挂起，加载态 / 登录门禁由页面
 * early return 承载）；`enabled: userId != null` 是登录门禁的唯一真相，
 * `throwOnError` 让失败照旧抛给错误边界。
 *
 * 数据只有一个来源（云端）：播放时上报由播放器负责，本页无需订阅任何本地写入事件；
 * KeepAlive 下页面常驻，所以用 `useEffectOnActive` 在**每次进入**时失效查询，
 * 保证刚播过的歌立刻出现在列表里。
 *
 * 页面组件只 import 本 hook，不直接触碰 store / service。
 */
export function useRecentPlaysViewModel(userId: number | null) {
  const play = playerService.play;
  const queryClient = useQueryClient();

  const { data, isPending } = useQuery({
    queryKey: ['recentSongs', userId],
    queryFn: () => getRecentSongs(userId as number),
    enabled: userId != null,
    throwOnError: true,
  });

  useEffectOnActive(() => {
    if (userId != null) {
      void queryClient.invalidateQueries({ queryKey: ['recentSongs'] });
    }
  }, [queryClient, userId]);

  const items = useMemo(() => data ?? [], [data]);

  const handlePlay = useCallback(
    async (track: Song) => {
      try {
        await play(track);
      } catch (e) {
        toast.error(reportError('recent.play', e, '播放失败'));
      }
    },
    [play],
  );

  return useMemo(() => ({ items, isPending, handlePlay }), [items, isPending, handlePlay]);
}
