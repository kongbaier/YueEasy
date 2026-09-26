import { useQuery } from '@tanstack/react-query';
import {
  getMusicComments,
  getPlaylistComments,
} from '@/features/comment/services/CommentService';

type CommentTarget =
  | { type: 'playlist'; id: number | undefined }
  | { type: 'music'; id: number | undefined };

export function useComments(target: CommentTarget) {
  const { data, isPending, isError } = useQuery({
    queryKey:
      target.type === 'playlist'
        ? ['playlist-comments', target.id]
        : ['music-comments', target.id],
    queryFn: () => {
      if (!target.id) return null;
      if (target.type === 'playlist') return getPlaylistComments(target.id);
      return getMusicComments(target.id);
    },
  });

  return { data, isPending, isError };
}
