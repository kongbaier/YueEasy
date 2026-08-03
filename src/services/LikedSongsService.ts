import type { SongRef } from '@/shared/types/playlist';
import { ncm, toSongRef } from '@/tauri/ncm';

export async function getLikedSongs(userId: number): Promise<SongRef[]> {
  const res = await ncm.likeList(userId);
  if (!res.ids.length) return [];
  const detail = await ncm.songDetail(res.ids);
  return detail.songs.map(toSongRef);
}
