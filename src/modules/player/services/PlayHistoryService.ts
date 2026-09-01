// PlayHistoryService —— 本地播放记录服务（业务就近）。
//
// 写入：每次实际播放（PlayerService::resolveAndPlay）经 recordPlay 落库（SQLite play_history），
//       受设置 savePlaybackHistory 开关控制；best-effort，失败仅告警、不打断播放。
// 读取：最近播放页综合视图取本地记录（getLocalHistory）。

import { usePlayerSettingsStore } from "@/modules/player/stores/playerSettingsStore";
import type { LocalPlayRecord, QueueItem } from "@/shared/types/entities";
import { localHistoryAdd, localHistoryGet } from "@/tauri/history";

/** 本地记录读取上限（对齐云记录 300 首；Rust 侧 MAX_LOCAL_RECORDS 同为 300）。 */
export const LOCAL_HISTORY_LIMIT = 300;

// 本地记录写入成功 → 通知订阅方（最近播放页实时刷新）。
type Listener = () => void;
const listeners = new Set<Listener>();

/** 订阅「本地播放记录已变化」事件。返回取消订阅函数。 */
export function onLocalHistoryChanged(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emitHistoryChanged(): void {
  for (const l of listeners) l();
}

/** 记录一次实际播放。开关关闭时直接跳过；写入失败仅告警，成功则触发变更通知。 */
export function recordPlay(item: QueueItem): void {
  const { savePlaybackHistory } = usePlayerSettingsStore.getState().player;
  if (!savePlaybackHistory) return;

  localHistoryAdd({
    song_id: item.track_id,
    song_name: item.title,
    artist: item.artist,
    album: item.album,
    cover_url: item.cover_url,
    // QueueItem.duration_secs 为毫秒换算的小数秒，Rust 侧为 i64 → 取整
    duration_secs: Math.round(item.duration_secs),
    played_at_ms: Date.now(),
  })
    .then(() => emitHistoryChanged())
    .catch((e) => console.warn("[history] record play failed", e));
}

/** 读取本地播放记录（去重、played_at_ms 倒序）。 */
export function getLocalHistory(
  limit: number = LOCAL_HISTORY_LIMIT,
): Promise<LocalPlayRecord[]> {
  return localHistoryGet(limit);
}
