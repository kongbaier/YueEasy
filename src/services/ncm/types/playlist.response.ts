import type { NcmSong } from "./song.response";

// NCM API Response: /personalized
export interface PersonalizedPlaylist {
  alg: string;
  canDislike: boolean;
  highQuality: boolean;
  id: number;
  name: string;
  picUrl: string;
  playCount: number;
  trackCount: number;
  trackNumberUpdateTime: number;
  type: number;
}

export interface PersonalizedResponse {
  category: number;
  code: number;
  hasTaste: boolean;
  result: PersonalizedPlaylist[];
}

// NCM API Response: /top_playlist
export interface TopPlaylist {
  id: number;
  name: string;
  coverImgUrl: string;
  playCount: number;
  trackCount: number;
  description?: string;
  creator: {
    userId: number;
    nickname: string;
    avatarUrl: string;
  };
  highQuality: boolean;
  subscribed?: boolean;
  subscribedCount?: number;
  tags?: string[];
  updateTime?: number;
  trackUpdateTime?: number;
}

export interface TopPlaylistResponse {
  cat: string;
  code: number;
  more: boolean;
  playlists: TopPlaylist[];
  total: number;
}

// NCM API Response: /playlist_detail
export interface PlaylistDetailResponse {
  playlist: TopPlaylist & {
    tracks: NcmSong[];
    createTime?: number;
    updateTime?: number;
    commentCount?: number;
    shareCount?: number;
    subscribed?: boolean;
    subscribedCount?: number;
    tags?: string[];
  };
}

// NCM API Response: /user_playlist
export interface UserPlaylistResponse {
  playlist: TopPlaylist[];
}

// NCM API Response: /recommend_resource
export interface PlaylistRecommendResponse {
  recommend: TopPlaylist[];
}
