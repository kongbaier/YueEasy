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
  ar: Artist[];
  al: Album;
  dt: number;
  url?: string;
  mv?: number;
  fee?: number;
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
