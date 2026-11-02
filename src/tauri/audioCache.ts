// 音频文件缓存 IPC 入口（infra 层）。
//
// 命令薄壳在 `src-tauri/src/commands/audio_cache.rs`；文件 / LRU 逻辑在
// `storage::audio_cache`，下载编排在 `service::audio_cache`。

import { invoke } from '@tauri-apps/api/core';
import type { AudioCacheStats } from '@/shared/types/uiModels';

/** 命中返回本地绝对路径（供 `convertFileSrc` 转 asset URL），未命中 `null`。 */
export function audioCacheGetPath(
  trackId: number,
  level?: string | null,
): Promise<string | null> {
  return invoke<string | null>('audio_cache_get', {
    trackId,
    level: level ?? null,
  });
}

/** 缓存目录绝对路径（设置页展示）。 */
export function audioCacheDir(): Promise<string> {
  return invoke<string>('audio_cache_dir');
}

/** 请求后台落盘（fire-and-forget：立刻返回，成败只留日志）。 */
export function audioCacheRequest(
  trackId: number,
  url: string,
  level?: string | null,
): Promise<void> {
  return invoke('audio_cache_request', {
    trackId,
    url,
    level: level ?? null,
  });
}

/** 下发容量上限；`0` = 关闭缓存。 */
export function audioCacheSetLimit(maxBytes: number): Promise<void> {
  return invoke('audio_cache_set_limit', { maxBytes });
}

export function audioCacheStats(): Promise<AudioCacheStats> {
  return invoke<AudioCacheStats>('audio_cache_stats');
}

export function audioCacheClear(): Promise<void> {
  return invoke('audio_cache_clear');
}

/** 删除该曲目所有音质变体（音频加载失败后重解析时调用）。 */
export function audioCacheRemove(trackId: number): Promise<void> {
  return invoke('audio_cache_remove', { trackId });
}
