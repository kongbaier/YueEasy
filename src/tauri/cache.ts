import { clear, get, set, stats } from 'tauri-plugin-cache-api';

export async function cacheGet<T>(key: string): Promise<T | null> {
  return get<T>(key);
}

export async function cacheSet<T>(key: string, value: T): Promise<void> {
  await set(key, value);
}

export async function cacheClearAll(): Promise<void> {
  await clear();
}

export async function cacheSize(): Promise<number> {
  const s = await stats();
  return s.totalSize;
}

/**
 * cache-first：有缓存直接返回（不阻塞 UI），后台静默刷新缓存；
 * 无缓存才发请求并写入。请求失败时保留旧缓存；真实错误会打到控制台，便于定位。
 */
export async function cachedFetch<T>(
  key: string,
  fetchFresh: () => Promise<T>,
): Promise<{ data: T; fromCache: boolean }> {
  let cached: T | null = null;
  try {
    cached = await cacheGet<T>(key);
  } catch (e) {
    console.error(`[cachedFetch] 读取缓存失败 key=${key}`, e);
  }

  // 有缓存：直接返回，后台再拉一次新鲜数据更新缓存
  if (cached) {
    void revalidate(key, cached, fetchFresh);
    return { data: cached, fromCache: true };
  }

  // 无缓存：请求并写入
  try {
    const fresh = await fetchFresh();
    await cacheSet(key, fresh);
    return { data: fresh, fromCache: false };
  } catch (e) {
    console.error(`[cachedFetch] 首次加载失败 key=${key}`, e);
    throw new Error('加载失败', { cause: e });
  }
}

/** 后台刷新缓存；失败仅告警，不影响已返回的旧数据。 */
async function revalidate<T>(
  key: string,
  oldValue: T,
  fetchFresh: () => Promise<T>,
): Promise<void> {
  try {
    const fresh = await fetchFresh();
    if (JSON.stringify(oldValue) !== JSON.stringify(fresh)) {
      await cacheSet(key, fresh);
    }
  } catch (e) {
    console.warn(`[cachedFetch] 后台刷新失败 key=${key}`, e);
  }
}

export const CacheKeys = {
  playlist: (id: number) => `playlist:${id}`,
  userPlaylists: (uid: number) => `user_pl:${uid}`,
  dailyRecommend: (date: string) => `daily:${date}`,
  personalized: 'home:personalized',
  topPlaylists: (cat: string) => `top_pl:${cat}`,
  banner: 'home:banner',
  searchHot: 'search:hot',
} as const;
