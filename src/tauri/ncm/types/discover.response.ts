import type { NcmSong } from './song.response';

// NCM API Response: /personal_fm 的歌曲条目（字段与 /song/detail 不同：artists/album/duration）
export interface FmSong {
  id: number;
  name: string;
  artists: Array<{ id: number; name: string }>;
  album: { id: number; name: string; picUrl: string };
  duration: number; // 毫秒
  fee?: number;
}

// NCM API Response: /personal_fm
export interface PersonalFmResponse {
  data: FmSong[];
}

// NCM API Response: /recommend_songs
export interface RecommendSongsResponse {
  code: number;
  data: {
    dailySongs: NcmSong[];
    fromCache: boolean;
  };
}

// NCM API Response: /fm_trash
export interface FmTrashResponse {
  code?: number;
  data?: unknown;
}

// NCM API Response: /homepage/dragon/ball 的圆形入口条目（含"私人雷达"）
export interface DragonBallItem {
  id: string;
  name?: string;
  title?: string;
  iconUrl?: string;
  resourceId?: string;
  resourceType?: string;
}

// NCM API Response: /homepage/dragon/ball
export interface DragonBallResponse {
  code: number;
  data: DragonBallItem[];
}

// NCM API Response: /playmode/intelligence/list 的单条歌曲（songInfo 为完整歌曲结构）
export interface IntelligenceSongItem {
  songInfo: NcmSong;
  reason?: string;
}

// NCM API Response: /playmode/intelligence/list
export interface IntelligenceListResponse {
  code?: number;
  data: IntelligenceSongItem[];
}
