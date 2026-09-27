import { clear, get, set, stats } from 'tauri-plugin-cache-api';

async function cacheGet<T>(key: string): Promise<T | null> {
  return get<T>(key);
}

async function cacheSet<T>(key: string, value: T): Promise<void> {
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
): Promise<T> {
  let cached: T | null = null;
  try {
    cached = await cacheGet<T>(key);
  } catch (e) {
    console.error(`[cachedFetch] 读取缓存失败 key=${key}`, e);
  }

  // 有缓存：直接返回，后台再拉一次新鲜数据更新缓存
  if (cached) {
    void revalidate(key, cached, fetchFresh);
    return cached;
  }

  // 无缓存：请求并写入
  try {
    const fresh = await fetchFresh();
    await cacheSet(key, fresh);
    return fresh;
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

/** 仅「每日推荐」使用磁盘缓存：key 带日期，当天内容稳定，跨重启可秒开。 */
export const CacheKeys = {
  dailyRecommend: (date: string) => `daily:${date}`,
} as const;
