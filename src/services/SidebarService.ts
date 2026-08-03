import { ncm } from '@/tauri/ncm';

export async function getUserPlaylists(uid: number) {
  const res = await ncm.userPlaylist(uid);
  return res.playlist.filter((p) => p.specialType !== 5);
}
