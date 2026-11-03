import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/features/auth/stores/authStore';
import { getLikedSongs } from '../services/LikedSongsService';
import { likedSongsQueryKey } from '../services/LikedSongsCache';

/**
 * 预热「我喜欢」查询（悬停 / 键盘聚焦侧栏入口时触发）。
 *
 * 为什么需要：首次进入要串行等 `ensureInit`（like_init + userPlaylist）→ `playlistDetail`，
 * 骨架屏会明显闪一下。提前把同一个查询写进缓存，页面首帧直接命中数据。
 * KeepAlive 只解决「再次进入」，解决不了本会话第一次进入。
 *
 * 只在悬停/聚焦时预热（而不是启动即预取）：喜欢歌单详情可能有上千首，启动时白付一次大包没意义。
 * prefetchQuery 自己吞掉错误，失败不打扰用户；真进页时 isLoading 的 useQuery 会重试。
 */
export function usePrefetchLikedSongs() {
  const userId = useAuthStore((s) => s.userId);
  const queryClient = useQueryClient();

  return useCallback(() => {
    if (userId == null) return;
    const queryKey = likedSongsQueryKey(userId);
    // 已有数据 / 已有在途请求都不重复打
    if (queryClient.getQueryData(queryKey)) return;
    if (queryClient.isFetching({ queryKey, exact: true }) > 0) return;
    void queryClient.prefetchQuery({
      queryKey,
      queryFn: () => getLikedSongs(userId),
    });
  }, [queryClient, userId]);
}
