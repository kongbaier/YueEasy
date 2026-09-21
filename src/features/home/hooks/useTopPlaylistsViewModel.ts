import { useSuspenseQuery } from '@tanstack/react-query';
import { getTopPlaylists } from '../home-service';

/** 热门歌单 viewmodel：只负责取数（service → infra）。 */
export function useTopPlaylistsViewModel() {
  const { data: topPlaylists } = useSuspenseQuery({
    queryKey: ['topPlaylist', '全部'],
    queryFn: () => getTopPlaylists('全部', 20),
  });

  return { topPlaylists };
}
