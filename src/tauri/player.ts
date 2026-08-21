// 播放器 IPC 命令唯一入口（infra 层）。
// 音频/队列权威已迁前端；本模块只剩「track_id → 播放 URL」的网络取数。
// 其余播放命令（play/next/seek/...）已由前端 AudioCore + QueueEngine 接管。

import { invoke } from '@tauri-apps/api/core';

/** 解析曲目播放 URL（Rust `resolve_play_url`）。返回 URL 字符串。 */
export function resolvePlayUrl(
  trackId: number,
  quality?: string | null,
): Promise<string> {
  return invoke('resolve_play_url', { trackId, quality: quality ?? null });
}
