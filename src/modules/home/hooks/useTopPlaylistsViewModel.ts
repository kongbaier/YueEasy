import { useSuspenseQuery } from '@tanstack/react-query';
import { homeService } from '../services/HomeService';

/** 热门歌单 viewmodel：只负责取数（service → infra）。 */
export function useTopPlaylistsViewModel() {
  const { data: topPlaylists } = useSuspenseQuery({
    queryKey: ['topPlaylist', '全部'],
    queryFn: () => homeService.topPlaylists().catch(() => []),
  });

  return { topPlaylists };
}
