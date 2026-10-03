// PlayerDataService —— 播放器数据服务（业务就近）。
// 封装播放所需的「从 Rust 取数」：URL 解析 + 私人漫游取歌 + 垃圾桶上报。
// 纯 async 数据函数，不 import React Query / 不 import store。

import { resolvePlayUrl } from '@/tauri/player';
import { ncm } from '@/tauri/ncm';
import type { QueueItem } from '@/shared/types/uiModels';
import { songToQueueItem } from '@/shared/utils/mappers';

/**
 * 解析曲目播放 URL（Rust `resolve_play_url`）。
 *
 * 返回 `null` 表示**不可播**（VIP / 无版权 / 仅试听）——正常业务值，调用方应跳过；
 * 抛错才是失败（网络 / 业务 code）。
 */
export async function resolveUrl(
  trackId: number,
  quality?: string | null,
): Promise<string | null> {
  return resolvePlayUrl(trackId, quality);
}

/**
 * 私人漫游取歌（Rust `personal_fm`）：返回一批新的 FM 曲目（已转 QueueItem）。
 */
export async function fetchFm(): Promise<QueueItem[]> {
  const songs = await ncm.personalFm();
  return songs.map(songToQueueItem);
}

/**
 * 「不感兴趣」上报（Rust `fm_trash`）。
 */
export async function trashFm(trackId: number): Promise<void> {
  await ncm.fmTrash(trackId);
}
