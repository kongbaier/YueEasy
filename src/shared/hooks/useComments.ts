import { useQuery } from '@tanstack/react-query';
import {
  getMusicComments,
  getPlaylistComments,
} from '@/services/CommentService';

type CommentTarget =
  | { type: 'playlist'; id: number }
  | { type: 'music'; id: number };

export function useComments(target: CommentTarget) {
  const { data, isLoading, isError } = useQuery({
    queryKey:
      target.type === 'playlist'
        ? ['playlist-comments', target.id]
        : ['music-comments', target.id],
    queryFn: () => {
      if (target.type === 'playlist') return getPlaylistComments(target.id);
      return getMusicComments(target.id);
    },
  });

  return { data, isLoading, isError };
}
