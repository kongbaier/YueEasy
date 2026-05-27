export interface Artist {
  id: number;
  name: string;
  picUrl?: string;
}

export interface Album {
  id: number;
  name: string;
  picUrl: string;
}

export interface Track {
  id: number;
  name: string;
  artists: Artist[];
  album: Album;
  duration: number;
  url?: string;
  mvId?: number;
  fee?: number;
  lyricId?: number;
}

export interface Playlist {
  id: number;
  name: string;
  coverImgUrl: string;
  picUrl?: string;
  trackCount: number;
  playCount: number;
  description?: string;
  creator?: User;
  tracks?: Track[];
}

export interface User {
  userId: number;
  nickname: string;
  avatarUrl: string;
  signature?: string;
}
