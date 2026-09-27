import type { Song } from '@/shared/types/uiModels';
import { CacheKeys, cachedFetch } from '@/tauri/cache';
import { ncm } from '@/tauri/ncm';

/** 当日推荐内容稳定，key 带日期 → 磁盘缓存跨重启秒开；服务端日切后自动换 key。 */
export function getDailyRecommendSongs(): Promise<Song[]> {
  const today = new Date().toISOString().slice(0, 10);
  return cachedFetch(CacheKeys.dailyRecommend(today), () =>
    ncm.recommendSongs(),
  );
}
