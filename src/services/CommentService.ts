import { ncm } from '@/tauri/ncm';
import type { NcmComment } from '@/tauri/ncm/types/comment.response';

export interface CommentResult {
  comments: NcmComment[];
  hotComments: NcmComment[];
  total: number;
}

export async function getPlaylistComments(
  playlistId: number,
  limit = 30,
): Promise<CommentResult> {
  const res = await ncm.commentPlaylist(playlistId, limit);
  return {
    comments: res.comments ?? [],
    hotComments: res.hotComments ?? [],
    total: res.total ?? 0,
  };
}

export async function getMusicComments(
  songId: number,
  limit = 40,
): Promise<CommentResult> {
  const res = await ncm.commentMusic(songId, limit, 0);
  return {
    comments: res.comments ?? [],
    hotComments: res.hotComments ?? [],
    total: res.total ?? 0,
  };
}
