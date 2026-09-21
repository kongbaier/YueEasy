// 数据映射函数（AGENTS.md §6）：Song(Track) ↔ QueueItem 互转。
// QueueItem 是前端队列持久化的扁平形状（snake_case wire 名，见 shared/types/entities.ts）；
// 播放器已前端权威化，本模块是 Song 实体与 QueueItem 之间的唯一转换落点。

import type { Track } from '@/shared/types/player';
import type { QueueItem } from '@/shared/types/uiModels';

/** Track(Song) → QueueItem：NCM 实体进入前端队列前的扁平化（如 FM 取歌）。 */
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
 * QueueItem → Track(Song)：队列持久化形状还原为 Song 实体，
 * 供 usePlayer 门面向 UI 呈现 currentTrack / queue。
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
