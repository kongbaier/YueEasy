import { useMemo } from 'react';
import { useSuspenseQuery } from '@tanstack/react-query';
import { getUserPlaylists } from './MyPlaylistsService';

export function useMyPlaylistsViewModel(userId: number) {
  const { data } = useSuspenseQuery({
    queryKey: ['userPlaylists', userId],
    queryFn: () => getUserPlaylists(userId),
  });

  return useMemo(
    () => ({
      created: data.filter((p) => p.creator?.id === userId),
      favorited: data.filter((p) => p.creator?.id !== userId),
    }),
    [data, userId],
  );
}
