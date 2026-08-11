import type { Playlist } from '@/shared/types/entities';
import { ncm } from '@/tauri/ncm';

export async function getUserPlaylists(uid: number): Promise<Playlist[]> {
  const res = await ncm.userPlaylist(uid);
  return res.filter((p) => p.specialType !== 5);
}

