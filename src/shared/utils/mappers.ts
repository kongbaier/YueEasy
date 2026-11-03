// 数据映射函数（AGENTS.md §6）：Song(Track) ↔ QueueItem 互转。
// QueueItem 是前端队列持久化的扁平形状（snake_case wire 名，见 shared/types/entities.ts）；
// 播放器已前端权威化，本模块是 Song 实体与 QueueItem 之间的唯一转换落点。

import type { Track } from '@/shared/types/player';
import type { LocalPlayRecord, QueueItem } from '@/shared/types/uiModels';

/**
 * Track(Song) → QueueItem：NCM 实体进入前端队列前的扁平化（如 FM 取歌）。
 *
 * 除展示用的 `artist` / `album` 字符串外，额外保留歌手 id 与专辑 id：
 * 播放器里的歌手名 / 专辑名要能跳二级页，而 id 不能从展示字符串反推
 * （曾用 `track_id` 冒充歌手 id，导致点开歌手页请求 `/artist/<歌曲id>` 返回 404）。
 */
export function songToQueueItem(track: Track): QueueItem {
  return {
    track_id: track.id,
    title: track.name,
    artist: track.artists?.map((a) => a.name).join(' / ') ?? '',
    album: track.album?.name ?? '',
    cover_url: track.album?.picUrl ?? '',
    duration_secs: (track.durationMs ?? 0) / 1000,
    artists: track.artists?.map(({ id, name }) => ({ id, name })) ?? [],
    album_id: track.album?.id ?? 0,
  };
}

/**
 * QueueItem → Track(Song)：队列持久化形状还原为 Song 实体，
 * 供 usePlayer 门面向 UI 呈现 currentTrack / queue。
 *
 * 歌手/专辑的 id 由 `songToQueueItem` 一并持久化，属于快照的约定字段，
 * 因此这里直接透传，不再做「没有 id 就用名字拼」的兜底。
 */
export function queueItemToSong(item: QueueItem): Track {
  return {
    id: item.track_id,
    name: item.title,
    artists: item.artists ?? [],
    album: {
      id: item.album_id ?? 0,
      name: item.album,
      picUrl: item.cover_url || undefined,
    },
    durationMs: Math.round(item.duration_secs * 1000),
  };
}

/**
 * 本地播放记录 → Song：最近播放页里「本地」来源的最小曲目实体。
 *
 * 歌手优先用写入时的 `{ id, name }` 快照（能点进歌手页）；旧库只有拼接后的
 * `artist` 名字串，则拆回只带名字的条目（id = 0，渲染成纯文本）。
 * 此前漏掉 `artists`，导致所有本地记录的歌手列都显示「未知歌手」。
 */
export function localPlayRecordToSong(record: LocalPlayRecord): Track {
  const artists = (record.artists ?? []).filter((a) => a.name.trim().length > 0);
  return queueItemToSong({
    track_id: record.song_id,
    title: record.song_name,
    artist: record.artist,
    album: record.album,
    cover_url: record.cover_url,
    duration_secs: record.duration_secs,
    artists:
      artists.length > 0
        ? artists
        : record.artist
            .split(' / ')
            .map((name) => name.trim())
            .filter(Boolean)
            .map((name) => ({ id: 0, name })),
    album_id: record.album_id ?? 0,
  });
}
