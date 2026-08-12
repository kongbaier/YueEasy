// 数据映射函数（AGENTS.md §6）：Track(Song) ↔ Rust QueueItem 互转。
// 与 Rust `service/ncm_service.rs::song_to_queue_item` 对齐（字段即 wire 名）。

import type { Track } from '@/shared/types/player';
import type { QueueItem } from '@/shared/types/entities';

/** Track(Song) → Rust `core::QueueItem`（供 `play_track`/`append_to_queue` 等 IPC 命令）。 */
export function songToQueueItem(track: Track): QueueItem {
  return {
    track_id: track.id,
    title: track.name,
    artist: track.artists?.map((a) => a.name).join(' / ') ?? '',
    album: track.album?.name ?? '',
    cover_url: track.album?.picUrl ?? '',
    duration_secs: (track.durationMs ?? 0) / 1000,
  };
}

/**
 * Rust `core::QueueItem` → Track(Song)（MirrorStore 镜像 → usePlayer 门面 UI 呈现）。
 * Phase F 逐组件替换为 QueueItem 消费后，此反向映射可随旧 UI 一并移除。
 */
export function queueItemToSong(item: QueueItem): Track {
  return {
    id: item.track_id,
    name: item.title,
    artists: item.artist ? [{ id: item.track_id, name: item.artist }] : [],
    album: {
      id: item.track_id,
      name: item.album,
      picUrl: item.cover_url || undefined,
    },
    durationMs: Math.round(item.duration_secs * 1000),
  };
}
