import { invoke } from '@tauri-apps/api/core';

export interface CacheEntry<T> {
  value: T;
  updatedAt: string;
}

export async function cacheGet<T>(key: string): Promise<CacheEntry<T> | null> {
  const raw = await invoke<string | null>('cache_get', { key });
  if (!raw) return null;
  try {
    return JSON.parse(raw) as CacheEntry<T>;
  } catch {
    return null;
  }
}

export async function cacheSet<T>(key: string, value: T): Promise<void> {
  const raw = JSON.stringify({ value, updatedAt: new Date().toISOString() });
  await invoke('cache_set', { key, value: raw });
}

export async function cacheDelete(key: string): Promise<void> {
  await invoke('cache_delete', { key });
}

export async function cacheClearPrefix(prefix: string): Promise<void> {
  await invoke('cache_clear', { prefix });
}

export async function cacheSize(): Promise<number> {
  return invoke<number>('cache_size');
}

export async function cacheClearAll(): Promise<void> {
  await invoke('cache_clear', { prefix: '' });
}

/** 读取缓存 → 网络更新 → 网络失败则回退缓存 */
export async function cachedFetch<T>(
  key: string,
  fetchFresh: () => Promise<T>,
): Promise<{ data: T; fromCache: boolean }> {
  const cached = await cacheGet<T>(key);

  try {
    const fresh = await fetchFresh();
    if (!cached || JSON.stringify(cached.value) !== JSON.stringify(fresh)) {
      await cacheSet(key, fresh);
    }
    return { data: fresh, fromCache: false };
  } catch {
    if (cached) return { data: cached.value, fromCache: true };
    throw new Error('加载失败');
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
