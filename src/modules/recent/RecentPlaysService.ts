import type { Song } from '@/shared/types/entities';
import { ncm } from '@/tauri/ncm';

export async function getRecentSongs(userId: number): Promise<Song[]> {
  const res = await ncm.recentSong(userId);
  return res.list.map((item) => item.song);
}

