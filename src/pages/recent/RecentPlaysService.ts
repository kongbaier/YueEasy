import type { LocalPlayRecord, Song } from '@/shared/types/entities';
import { ncm } from '@/tauri/ncm';
import { getLocalHistory } from '@/modules/player/services/PlayHistoryService';
import { queueItemToSong } from '@/shared/utils/mappers';

/** 最近播放综合条目：统一 Song + 播放时间 + 来源（云/本地）。 */
export interface UnifiedRecentItem {
  song: Song;
  /** 毫秒时间戳，云 `playTimeMs` 与本地 `played_at_ms` 同单位。 */
  playedAtMs: number;
  source: 'cloud' | 'local';
}

/** 本地记录 → 最小 Song（复用 queueItemToSong，字段即 wire 名）。 */
function localRecordToSong(r: LocalPlayRecord): Song {
  return queueItemToSong({
    track_id: r.song_id,
    title: r.song_name,
    artist: r.artist,
    album: r.album,
    cover_url: r.cover_url,
    duration_secs: r.duration_secs,
  });
}

/**
 * 综合最近播放：登录取云记录 + 本地记录，按 song_id 去重（同曲只留一条），
 * 优先展示播放时间更「新」的那条记录（含来源与排序时间），按播放时间倒序。
 * 未登录或开关关闭时对应来源为空。
 */
export async function getCombinedRecent(
  userId: number | null,
  localEnabled: boolean,
): Promise<UnifiedRecentItem[]> {
  const [cloud, local] = await Promise.all([
    userId ? ncm.recentSong(userId) : Promise.resolve(null),
    localEnabled ? getLocalHistory() : Promise.resolve([] as LocalPlayRecord[]),
  ]);

  const map = new Map<number, UnifiedRecentItem>();
  for (const item of cloud?.list ?? []) {
    map.set(item.song.id, {
      song: item.song,
      playedAtMs: item.playTimeMs,
      source: 'cloud',
    });
  }
  for (const r of local) {
    const prev = map.get(r.song_id);
    // 本地更新则整条采用本地记录；否则保留云端条目
    if (!prev || r.played_at_ms > prev.playedAtMs) {
      map.set(r.song_id, {
        song: localRecordToSong(r),
        playedAtMs: r.played_at_ms,
        source: 'local',
      });
    }
  }

  return [...map.values()].toSorted((a, b) => b.playedAtMs - a.playedAtMs);
}
