// AudioCacheService —— 音频文件磁盘缓存（service 层，播放器业务就近）。
//
// 职责：把「track_id → 本地可播 URL」与「远端 URL → 后台落盘」封装成两个纯 async 能力，
// 供 `PlayerService` 的 URL 解析链使用；并把「缓存上限」设置下发到 Rust。
//
// 磁盘细节（目录 / LRU / 原子写）全在 Rust `storage::audio_cache`，本层不碰 fs / 不碰 store。

import { convertFileSrc } from '@tauri-apps/api/core';
import {
  audioCacheClear,
  audioCacheDir,
  audioCacheGetPath,
  audioCacheRemove,
  audioCacheRequest,
  audioCacheSetLimit,
  audioCacheStats,
} from '@/tauri/audioCache';
import type { AudioCacheStats } from '@/shared/types/uiModels';
import { usePlayerSettingsStore } from '../stores/playerSettingsStore';

const MB = 1024 * 1024;

/**
 * 当前音质标识（缓存 key 的一部分）。
 * 音质设置尚未接入（`resolveUrl` 传 null）→ 恒为 null，落盘文件名是 `{id}-default.{ext}`。
 */
function currentLevel(): string | null {
  return null;
}

function limitMB(): number {
  const mb = usePlayerSettingsStore.getState().player.audioCacheLimitMB;
  return Number.isFinite(mb) && mb > 0 ? Math.round(mb) : 0;
}

export function isCacheEnabled(): boolean {
  return limitMB() > 0;
}

/**
 * 本地命中 → 可直接给 `<audio src>` 的 asset URL（`convertFileSrc`）；未命中 `null`。
 *
 * 命中路径没有签名 / 不会过期，调用方应把它当作「永久有效」的 URL（不要套 TTL）。
 */
export async function localUrl(trackId: number): Promise<string | null> {
  if (!isCacheEnabled()) return null;
  // 正在被删除的曲目不参与本地命中（删文件是异步 IPC，避免拿到正被删的那份）
  if (removing.has(trackId)) return null;
  const path = await audioCacheGetPath(trackId, currentLevel());
  return path ? convertFileSrc(path) : null;
}

/**
 * 起播后请求后台落盘（fire-and-forget）：不阻塞播放，失败只留日志。
 * 首次播放会因此多一份下行流量（≈2x），这是「下次秒开 / 断网可播」的代价。
 */
export function requestCache(trackId: number, remoteUrl: string): void {
  if (!remoteUrl || !isCacheEnabled()) return;
  void audioCacheRequest(trackId, remoteUrl, currentLevel()).catch((e) => {
    console.warn('[audioCache] 落盘请求失败', trackId, e);
  });
}

/**
 * 删除该曲目的所有音质变体。
 * 用于音频加载失败后的重解析：损坏 / 半截的本地文件不删掉会一直被命中。
 */
export function invalidate(trackId: number): void {
  removing.add(trackId);
  void audioCacheRemove(trackId)
    .catch((e) => {
      console.warn('[audioCache] 删除缓存失败', trackId, e);
    })
    .finally(() => removing.delete(trackId));
}

/** 正在删除缓存的曲目（避免删除过程中再次命中同一个坏文件）。 */
const removing = new Set<number>();

let lastAppliedLimitMB = -1;

/** 把设置里的上限下发到 Rust（缩小时 Rust 侧会立即淘汰超额文件）。重复下发无害。 */
export function applyLimitFromSettings(): void {
  const mb = limitMB();
  if (mb === lastAppliedLimitMB) return;
  lastAppliedLimitMB = mb;
  void audioCacheSetLimit(mb * MB).catch((e) => {
    console.warn('[audioCache] 下发缓存上限失败', e);
    lastAppliedLimitMB = -1; // 失败后允许下次重试
  });
}

export function getStats(): Promise<AudioCacheStats> {
  return audioCacheStats();
}

/** 缓存目录绝对路径（设置页展示用）。 */
export function getCacheDir(): Promise<string> {
  return audioCacheDir();
}

export function clear(): Promise<void> {
  return audioCacheClear();
}

// 设置变更即时下发：`audioCacheLimitMB` 是唯一需要同步到 Rust 的字段。
// 与 SettingsService 的订阅互不干扰（一个写盘，一个下发 Rust）。
usePlayerSettingsStore.subscribe(() => {
  applyLimitFromSettings();
});
