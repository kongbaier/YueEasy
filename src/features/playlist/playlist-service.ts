import type { Playlist } from '@/shared/types/uiModels';
import { CacheKeys, cacheGet, cacheSet } from '@/tauri/cache';
import { ncm } from '@/tauri/ncm';

export async function getPlaylistDetail(
  id: number,
): Promise<{ playlist: Playlist; fromCache: boolean }> {
  const key = CacheKeys.playlist(id);

  const cached = await cacheGet<Playlist>(key);

  try {
    const fresh = await ncm.playlistDetail(id);

    if (!cached || cached.trackCount !== fresh.trackCount) {
      await cacheSet(key, fresh);
    }

    return { playlist: fresh, fromCache: false };
  } catch {
    if (cached) {
      return { playlist: cached, fromCache: true };
    }
    throw new Error('加载歌单失败');
  }
}

/** 收藏 / 取消收藏歌单（远程权威；失败由调用方回滚乐观状态）。 */
export async function setPlaylistSubscribed(
  id: number,
  subscribe: boolean,
): Promise<void> {
  await ncm.playlistSubscribe(id, subscribe);
}
