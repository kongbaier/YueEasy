import type { NcmSong } from "./song.response";

// NCM API Response: /personal_fm
export interface PersonalFmResponse {
  data: NcmSong[];
}

// NCM API Response: /recommend_songs
export interface RecommendSongsResponse {
  code: number;
  data: {
    dailySongs: NcmSong[];
    fromCache: boolean;
  };
}
