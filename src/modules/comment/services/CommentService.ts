import type { CommentPage } from '@/shared/types/entities';
import { ncm } from '@/tauri/ncm';

export type CommentResult = CommentPage;

export async function getPlaylistComments(
  playlistId: number,
  limit = 30,
): Promise<CommentPage> {
  return ncm.commentPlaylist(playlistId, limit);
}

export async function getMusicComments(
  songId: number,
  limit = 40,
): Promise<CommentPage> {
  return ncm.commentMusic(songId, limit, 0);
}
