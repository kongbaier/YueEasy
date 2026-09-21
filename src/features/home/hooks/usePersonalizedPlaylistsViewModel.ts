import { useSuspenseQuery } from '@tanstack/react-query';
import { getPersonalized } from '../home-service';

/** 推荐歌单 viewmodel：只负责取数（service → infra）。 */
export function usePersonalizedPlaylistsViewModel() {
  const { data: playlists } = useSuspenseQuery({
    queryKey: ['personalizedPlaylist'],
    queryFn: () => getPersonalized(),
  });

  return { playlists };
}
