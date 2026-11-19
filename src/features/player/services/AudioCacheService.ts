// AudioCacheService —— 音频文件磁盘缓存（service 层，播放器业务就近）。
//
// 职责：把「track_id + 音质 → 本地可播 URL」与「远端 URL → 后台落盘」封装成几个纯
// async 能力，供 `PlayerService` 的 URL 解析链使用；并把「缓存上限」设置下发到 Rust。
//
// 磁盘细节（目录 / LRU / 原子写）全在 Rust `storage::audio_cache`，本层不碰 fs / 不碰 store。
//
// 音质与缓存的关系（一问一答）：
// - **key = 服务端实际给出的档位**（`{id}-{level}.{ext}`），不是「设置里请求的档位」。
//   否则非 VIP 请求无损拿到的 320k mp3 会被存进「无损」目录，账号升 VIP 后仍命中那份
//   低档文件 —— 音质设置等于没生效，徽标也会说错。
// - **同一首可以存在多份不同档位的文件**：互不覆盖（不同 key），切档位不用重下，
//   空间统一由 LRU 上限淘汰。
// - 被降级的响应照常落盘（存进**实际**档位），所以无权限时缓存依旧可用。

import { convertFileSrc } from '@tauri-apps/api/core';
import {
  audioCacheClear,
  audioCacheDir,
  audioCacheGetPath,
  audioCacheRemove,
  audioCacheRequest,
  audioCacheSetLimit,
  audioCacheStats,
  audioCacheVariants,
} from '@/tauri/audioCache';
import type { AudioCacheStats } from '@/shared/types/uiModels';
import { usePlayerSettingsStore } from '../stores/playerSettingsStore';

const MB = 1024 * 1024;

function limitMB(): number {
  const mb = usePlayerSettingsStore.getState().player.audioCacheLimitMB;
  return Number.isFinite(mb) && mb > 0 ? Math.round(mb) : 0;
}

export function isCacheEnabled(): boolean {
  return limitMB() > 0;
}

/** 正在删除缓存的曲目（避免删除过程中再次命中同一个坏文件）。 */
const removing = new Set<number>();

/**
 * 命中指定音质的本地文件 → 可直接给 `<audio src>` 的 asset URL；未命中 `null`。
 *
 * 命中路径没有签名 / 不会过期，调用方应把它当作「永久有效」的 URL（不要套 TTL）。
 */
export async function localUrl(
  trackId: number,
  level: string,
): Promise<string | null> {
  if (!isCacheEnabled()) return null;
  // 正在被删除的曲目不参与本地命中（删文件是异步 IPC，避免拿到正被删的那份）
  if (removing.has(trackId)) return null;
  const path = await audioCacheGetPath(trackId, level);
  return path ? convertFileSrc(path) : null;
}

/**
 * 该曲目已缓存的**所有**音质档位（从高到低）。
 *
 * 只有「解析拿不到网络地址」（离线）时才需要：退回已缓存的任意一档，总比直接失败好。
 * 同一首可以有多份（见文件头），所以这里返回列表，由调用方按需挑。
 */
export async function cachedLevels(trackId: number): Promise<string[]> {
  if (!isCacheEnabled()) return [];
  try {
    const variants = await audioCacheVariants(trackId);
    return variants.map((v) => v.level);
  } catch (e) {
    console.warn('[audioCache] 读取音质变体失败', trackId, e);
    return [];
  }
}

/**
 * 起播后请求后台落盘（fire-and-forget）：不阻塞播放，失败只留日志。
 * 首次播放会因此多一份下行流量（≈2x），这是「下次秒开 / 断网可播」的代价。
 *
 * `level` 必须是**服务端实际给出的档位**（不是设置里请求的那个）。
 */
export function requestCache(
  trackId: number,
  remoteUrl: string,
  level: string,
): void {
  if (!remoteUrl || !isCacheEnabled()) return;
  void audioCacheRequest(trackId, remoteUrl, level).catch((e) => {
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
