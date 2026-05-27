import type { Playlist } from "@/types/music";
import { CacheKeys, cacheGet, cacheSet } from "./cache";
import { ncm } from "./ncm";

export async function getPlaylistDetail(
  id: number,
): Promise<{ playlist: Playlist; fromCache: boolean }> {
  const key = CacheKeys.playlist(id);

  const cached = await cacheGet<Playlist>(key);

  try {
    const fresh = await ncm.playlistDetail(id);
    const playlist = fresh.playlist;

    if (!cached || cached.value.trackCount !== playlist.trackCount) {
      await cacheSet(key, playlist);
    }

    return { playlist, fromCache: false };
  } catch {
    if (cached) {
      return { playlist: cached.value, fromCache: true };
    }
    throw new Error("加载歌单失败");
  }
}
