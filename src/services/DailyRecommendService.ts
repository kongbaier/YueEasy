import type { SongRef } from '@/shared/types/playlist';
import { CacheKeys, cachedFetch } from '@/tauri/cache';
import { ncm, toSongRef } from '@/tauri/ncm';

export async function getDailyRecommendSongs(): Promise<SongRef[]> {
  const today = new Date().toISOString().slice(0, 10);
  const r = await cachedFetch(CacheKeys.dailyRecommend(today), () =>
    ncm.recommendSongs(),
  );
  return (r.data.data.dailySongs ?? []).map(toSongRef);
}
