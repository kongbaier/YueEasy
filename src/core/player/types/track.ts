/** 播放器使用的歌曲业务模型 */
export interface Track {
  id: number;
  name: string;
  artists: TrackArtist[];
  album: TrackAlbum;
  duration: number;
  url: string;
}

export interface TrackArtist {
  id: number;
  name: string;
}

export interface TrackAlbum {
  id: number;
  name: string;
  picUrl?: string;
}
