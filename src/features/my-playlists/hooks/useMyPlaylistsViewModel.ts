import { useQuery } from '@tanstack/react-query';
import { getUserPlaylists } from '@/shared/services/UserService';

/**
 * 我的歌单 viewmodel：userId 为空（未登录）时不发请求，返回空列表。
 * 用非 Suspense 的 useQuery + enabled 门控：页面不需要 Suspense 边界，登录门禁与取数门禁
 * 共用同一个真相（userId），首次加载用 isLoading 驱动骨架屏。
 * 注意：不能加 placeholderData —— v5 里 placeholderData 会把 status 置为 success，
 * 令 isLoading(= isPending && isFetching) 恒为 false，骨架屏就永远不会出现。
 */
export function useMyPlaylistsViewModel(userId: number | null) {
  const { data, isLoading } = useQuery({
    queryKey: ['userPlaylists', userId],
    queryFn: () => (userId == null ? [] : getUserPlaylists(userId)),
    enabled: userId != null,
  });
  const list = data ?? [];

  return {
    created: list.filter((p) => p.creator?.id === userId),
    favorited: list.filter((p) => p.creator?.id !== userId),
    isLoading,
  };
}
