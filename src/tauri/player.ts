// 播放器 IPC 命令唯一入口（infra 层）。
// 音频/队列权威已迁前端；本模块只剩「track_id + 音质 → 播放 URL」的网络取数。
// 其余播放命令（play/next/seek/...）已由前端 AudioCore + QueueEngine 接管。

import { invoke } from '@tauri-apps/api/core';
import type { PlayUrl } from '@/shared/types/uiModels';

/**
 * 解析曲目播放 URL（Rust `resolve_play_url`）。
 *
 * `quality` 是 NCM 的 `level` 档位（`standard` / `higher` / `exhigh` / `lossless` /
 * `hires` / `jymaster` / `sky`）；`null` 由 Rust 侧按 `exhigh`（320k）兜底。
 *
 * 返回 `null` 表示**不可播**（VIP / 无版权 / 仅试听）——正常业务值，调用方应跳过；
 * 抛错才是失败（网络 / 业务 code），由调用方提示与重试。
 *
 * 返回值带 `level` / `br`：服务端可能静默降级（非 VIP 请求无损回极高），
 * 前端据此展示「实际到手」的音质。
 */
export function resolvePlayUrl(
  trackId: number,
  quality?: string | null,
): Promise<PlayUrl | null> {
  return invoke('resolve_play_url', { trackId, quality: quality ?? null });
}
