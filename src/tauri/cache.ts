import { invoke } from "@tauri-apps/api/core";

export interface CacheEntry<T> {
  value: T;
  updatedAt: string;
}

export async function cacheGet<T>(key: string): Promise<CacheEntry<T> | null> {
  const raw = await invoke<string | null>("cache_get", { key });
  if (!raw) return null;
  try {
    return JSON.parse(raw) as CacheEntry<T>;
  } catch {
    return null;
  }
}

export async function cacheSet<T>(key: string, value: T): Promise<void> {
  const raw = JSON.stringify({ value, updatedAt: new Date().toISOString() });
  await invoke("cache_set", { key, value: raw });
}

export async function cacheDelete(key: string): Promise<void> {
  await invoke("cache_delete", { key });
}

export async function cacheClearPrefix(prefix: string): Promise<void> {
  await invoke("cache_clear", { prefix });
}

export async function cacheSize(): Promise<number> {
  return invoke<number>("cache_size");
}

export async function cacheClearAll(): Promise<void> {
  await invoke("cache_clear", { prefix: "" });
}

/**
 * cache-first：有缓存直接返回（不阻塞 UI），后台静默刷新缓存；
 * 无缓存才发请求并写入。请求失败时保留旧缓存；真实错误会打到控制台，便于定位。
 */
export async function cachedFetch<T>(
  key: string,
  fetchFresh: () => Promise<T>,
): Promise<{ data: T; fromCache: boolean }> {
  let cached: CacheEntry<T> | null = null;
  try {
    cached = await cacheGet<T>(key);
  } catch (e) {
    console.error(`[cachedFetch] 读取缓存失败 key=${key}`, e);
  }

  // 有缓存：直接返回，后台再拉一次新鲜数据更新缓存
  if (cached) {
    void revalidate(key, cached.value, fetchFresh);
    return { data: cached.value, fromCache: true };
  }

  // 无缓存：请求并写入
  try {
    const fresh = await fetchFresh();
    await cacheSet(key, fresh);
    return { data: fresh, fromCache: false };
  } catch (e) {
    console.error(`[cachedFetch] 首次加载失败 key=${key}`, e);
    throw new Error("加载失败", { cause: e });
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

/**
 * 缓存键。键里允许出现 `:` 等字符——Rust `cache.rs` 的 `sanitize_key` 会统一清洗成
 * 合法文件名（`:` → `_`）。若未来命令返回形状再次变更，再整体升级键前缀。
 */
export const CacheKeys = {
  playlist: (id: number) => `playlist:${id}`,
  userPlaylists: (uid: number) => `user_pl:${uid}`,
  dailyRecommend: (date: string) => `daily:${date}`,
  personalized: "home:personalized",
  topPlaylists: (cat: string) => `top_pl:${cat}`,
  banner: "home:banner",
  searchHot: "search:hot",
} as const;

