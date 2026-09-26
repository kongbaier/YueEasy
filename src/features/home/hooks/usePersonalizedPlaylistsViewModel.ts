import { useQuery } from '@tanstack/react-query';
import { getPersonalized } from '../home-service';

/**
 * 推荐歌单 viewmodel：只负责取数（service → infra）。
 *
 * 用 useQuery 而非 useSuspenseQuery：首页各区块彼此独立，不能因为没有
 * Suspense 边界而让整个首页一起被扣住（也避免单块失败炸掉整棵树）。
 */
export function usePersonalizedPlaylistsViewModel() {
  const { data: playlists, isLoading } = useQuery({
    queryKey: ['personalizedPlaylist'],
    queryFn: () => getPersonalized(),
  });

  return { playlists, isLoading };
}
