// 本地播放历史 IPC 唯一入口（infra 层）。
// 封装 Rust `cmd/history.rs` 的 history_add / history_get（SQLite yueeasy.db）。

import { invoke } from '@tauri-apps/api/core';
import type { LocalPlayRecord } from '@/shared/types/entities';

/** 写入一条本地播放记录（Rust `history_add`，入参即记录本身）。 */
export function localHistoryAdd(
  record: Omit<LocalPlayRecord, 'id'>,
): Promise<void> {
  return invoke('history_add', { record });
}

/** 读取本地播放记录（Rust `history_get`，按曲目去重、played_at_ms 倒序）。 */
export function localHistoryGet(
  limit: number,
  offset = 0,
): Promise<LocalPlayRecord[]> {
  return invoke('history_get', { limit, offset });
}
