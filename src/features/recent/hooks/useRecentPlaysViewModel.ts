import { useCallback, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getCombinedRecent } from '../recent-service';
import { toast } from '@/shared/lib/toast';
import { reportError } from '@/shared/utils/error';
import type { Song } from '@/shared/types/uiModels';
import { playerService } from '@/features/player/services/PlayerService';
import { onLocalHistoryChanged } from '@/features/player/services/PlayHistoryService';

/**
 * 最近播放页 viewmodel：React Query 取数（云 + 本地综合）+ playerService 命令。
 * userId 为空时仅取本地记录；localEnabled 控制本地来源是否并入。
 *
 * 用非 Suspense 的 useQuery + enabled 门控（与 playlist / my-playlists 一致）：
 * 页面自身不挂起，加载态与登录门禁都由页面 early return 承载，
 * 从而省掉「为承载 Suspense 边界而多包一层 Content 组件」。
 * throwOnError 让取数失败照旧抛给上层错误边界，与 suspense 模式行为一致。
 *
 * 订阅本地播放记录变更事件，播放后实时失效综合查询（后台重取）。
 * 页面组件只 import 本 hook，不直接触碰 store / service。
 */
export function useRecentPlaysViewModel(
  userId: number | null,
  localEnabled: boolean,
) {
  const play = playerService.play;
  const queryClient = useQueryClient();

  const { data, isPending } = useQuery({
    queryKey: ['recentSongs', userId, localEnabled],
    queryFn: () => getCombinedRecent(userId, localEnabled),
    // 云（已登录）与本地（开关打开）任一可用即可取数，全不可用时不发请求。
    enabled: localEnabled || userId != null,
    throwOnError: true,
  });

  const items = useMemo(() => data ?? [], [data]);

  // 本地记录变化（有新的播放落库）→ 失效综合查询，后台重取实现实时更新。
  useEffect(() => {
    return onLocalHistoryChanged(() => {
      void queryClient.invalidateQueries({ queryKey: ['recentSongs'] });
    });
  }, [queryClient]);

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

  return useMemo(
    () => ({ items, isPending, handlePlay }),
    [items, isPending, handlePlay],
  );
}
