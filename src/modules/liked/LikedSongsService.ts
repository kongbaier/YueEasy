import type { Song } from '@/shared/types/entities';
import { ncm } from '@/tauri/ncm';

export async function getLikedSongs(userId: number): Promise<Song[]> {
  const res = await ncm.likeList(userId);
  if (!res.ids.length) return [];
  return ncm.songDetail(res.ids);
}

