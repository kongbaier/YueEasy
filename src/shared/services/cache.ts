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

export const CacheKeys = {
  playlist: (id: number) => `playlist:${id}`,
  userPlaylists: (uid: number) => `user_pl:${uid}`,
  dailyRecommend: (date: string) => `daily:${date}`,
  personalized: "home:personalized",
  topPlaylists: (cat: string) => `top_pl:${cat}`,
  banner: "home:banner",
} as const;
