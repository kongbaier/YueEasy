import type { SongRef } from '@/shared/types/playlist';
import { ncm, toSongRef } from '@/tauri/ncm';

export async function getAlbumDetail(id: number): Promise<{
  album: {
    id: number;
    name: string;
    picUrl?: string;
    description?: string;
    size?: number;
    publishTime?: number;
    company?: string;
    artist?: { name: string };
  };
  tracks: SongRef[];
}> {
  const res = await ncm.albumDetail(id);
  return {
    album: res.album,
    tracks: res.songs.map(toSongRef),
  };
}
