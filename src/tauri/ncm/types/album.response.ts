import type { NcmSong } from "./song.response";

// NCM API Response: /album (GET /api/v1/album/{id})

export interface NcmAlbumArtist {
  id: number;
  name: string;
  picUrl?: string;
}

export interface NcmAlbum {
  id: number;
  name: string;
  picUrl: string;
  artist: NcmAlbumArtist;
  publishTime: number; // ms timestamp
  size: number; // track count
  company?: string;
  description?: string;
  subType?: string;
  type?: string;
}

export interface AlbumDetailResponse {
  album: NcmAlbum;
  songs: NcmSong[];
}
