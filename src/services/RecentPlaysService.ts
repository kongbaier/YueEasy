import type { SongRef } from '@/shared/types/playlist';
import { ncm, toSongRef } from '@/tauri/ncm';

export async function getRecentSongs(userId: number): Promise<SongRef[]> {
  const res = await ncm.recentSong(userId);
  return res.data.list.map((item) => toSongRef(item.data));
}
