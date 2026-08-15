import type { Song } from '@/shared/types/entities';
import { CacheKeys, cachedFetch } from '@/tauri/cache';
import { ncm } from '@/tauri/ncm';

export async function getDailyRecommendSongs(): Promise<Song[]> {
  const today = new Date().toISOString().slice(0, 10);
  const r = await cachedFetch(CacheKeys.dailyRecommend(today), () =>
    ncm.recommendSongs(),
  );
  return r.data;
}
