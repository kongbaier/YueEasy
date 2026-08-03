import type { Playlist, SongRef } from '@/shared/types/playlist';
import type { Track } from '@/core/types';
import type {
  PersonalizedPlaylist,
  TopPlaylist,
} from './types/playlist.response';
import type { NcmSong } from './types/song.response';
import type { FmSong } from './types/discover.response';

export function toPlaylist(p: PersonalizedPlaylist): Playlist;
export function toPlaylist(p: TopPlaylist): Playlist;
export function toPlaylist(p: PersonalizedPlaylist | TopPlaylist): Playlist {
  const detail = p as Partial<{
    subscribedCount: number;
    commentCount: number;
    shareCount: number;
    createTime: number;
    updateTime: number;
  }>;

  return {
    id: p.id,
    name: p.name,
    coverUrl: 'picUrl' in p ? p.picUrl : p.coverImgUrl,
    trackCount: p.trackCount,
    playCount: p.playCount,
    description: 'creator' in p ? p.description : undefined,
    creator: 'creator' in p ? p.creator : undefined,
    tags: 'tags' in p ? p.tags : undefined,
    subscribedCount: detail.subscribedCount,
    commentCount: detail.commentCount,
    shareCount: detail.shareCount,
    createTime: detail.createTime,
    updateTime: detail.updateTime,
  };
}

export function toSongRef(s: NcmSong): SongRef {
  return {
    id: s.id,
    name: s.name,
    artists: s.ar ?? [],
    album: s.al ?? { id: 0, name: '', picUrl: '' },
    duration: s.dt,
    fee: s.fee,
  };
}

/** 把 FM 接口条目（artists/album/duration 字段）映射为 Track。 */
export function toFmSong(s: FmSong): Track {
  return {
    id: s.id,
    name: s.name,
    artists: s.artists ?? [],
    album: s.album ?? { id: 0, name: '', picUrl: '' },
    duration: s.duration,
  };
}
