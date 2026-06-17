// NCM API Response: /song/url
export interface SongUrlItem {
  url: string;
  type: string;
  id: number;
}

export interface SongUrlResponse {
  data: SongUrlItem[];
}

// NCM API Response: /song/detail
export interface NcmSong {
  id: number;
  name: string;
  ar: Array<{ id: number; name: string }>;
  al: { id: number; name: string; picUrl: string };
  dt: number; // 毫秒
  fee?: number;
}

export interface SongDetailResponse {
  songs: NcmSong[];
}

// NCM API Response: /cloudsearch
export interface SearchResponse {
  result: {
    songs: NcmSong[];
    songCount: number;
  };
}

// NCM API Response: /lyric
export interface LyricLine {
  time: number;
  text: string;
}

export interface LyricResponse {
  lrc?: {
    lyric: string;
  };
  tlyric?: {
    lyric: string;
  };
}

/** 歌词行数据（/lyric/new 返回的单个歌词版本） */
export interface LyricVersionData {
  /** 歌词文本 */
  lyric: string;
  /** 版本号 */
  version: number;
}

/** NCM API Response: /lyric/new */
export interface LyricNewResponse {
  /** 标准 LRC 歌词 */
  lrc?: LyricVersionData;
  /** 逐字歌词（雅乐歌词 YRC 格式） */
  yrc?: LyricVersionData;
  /** 音译歌词 */
  klyric?: LyricVersionData;
  /** 中文翻译歌词 */
  tlyric?: LyricVersionData;
  /** 罗马音歌词 */
  romalrc?: LyricVersionData;
}

// NCM API Response: /likelist
export interface LikeListResponse {
  ids: number[];
  checkPoint: number;
  code: number;
}

// NCM API Response: /record/recent/song
export interface RecentSongItem {
  data: NcmSong;
  playTime: number;
  resourceId: string;
  resourceType: string;
}

export interface RecentSongResponse {
  data: {
    list: RecentSongItem[];
  };
}
