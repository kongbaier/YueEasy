// NCM cloudsearch response items

/** 搜索专辑条目 */
export interface NcmSearchAlbum {
  id: number;
  name: string;
  picUrl: string;
  artist: { id: number; name: string };
  size: number; // 专辑曲目数
  publishTime: number; // 发布时间戳(ms)
  company?: string;
}

/** 搜索歌手条目 */
export interface NcmSearchArtist {
  id: number;
  name: string;
  picUrl: string;
  alias: string[];
  albumSize: number;
  musicSize: number;
  mvSize?: number;
}

/** 搜索用户条目 */
export interface NcmSearchUser {
  userId: number;
  nickname: string;
  avatarUrl: string;
  signature?: string;
  gender: number; // 0=未知 1=男 2=女
  followeds: number; // 粉丝数
  follows: number; // 关注数
}

// NCM API Response: /cloudsearch (multi-type)

export interface SearchAlbumResponse {
  result: {
    albums: NcmSearchAlbum[];
    albumCount: number;
  };
}

export interface SearchArtistResponse {
  result: {
    artists: NcmSearchArtist[];
    artistCount: number;
  };
}

export interface SearchUserResponse {
  result: {
    userprofiles: NcmSearchUser[];
    userprofileCount: number;
  };
}

// NCM API Response: /search/suggest

export interface NcmSuggestSong {
  id: number;
  name: string;
  artists?: Array<{ name: string }>;
}

export interface NcmSuggestAlbum {
  id: number;
  name: string;
  artist?: { name: string };
}

export interface NcmSuggestArtist {
  id: number;
  name: string;
}

export interface SearchSuggestResponse {
  result: {
    songs?: NcmSuggestSong[];
    albums?: NcmSuggestAlbum[];
    artists?: NcmSuggestArtist[];
    playlists?: Array<{ id: number; name: string }>;
    order?: string[];
  };
}
