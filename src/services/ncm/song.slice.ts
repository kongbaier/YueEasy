import { ncmApi } from "./api";
import type {
  LyricResponse,
  SearchResponse,
  SongDetailResponse,
  SongUrlResponse,
} from "./types";

export type {
  LyricResponse,
  SearchResponse,
  SongDetailResponse,
  SongUrlResponse,
} from "./types";

export const songSlice = {
  search: (keywords: string, limit = 30, offset = 0) =>
    ncmApi<SearchResponse>("cloudsearch", {
      keywords,
      type: "1",
      limit: String(limit),
      offset: String(offset),
    }),

  songUrl: (id: number) =>
    ncmApi<SongUrlResponse>("song_url_v1", {
      id: String(id),
      level: "standard",
    }),

  songDetail: (ids: number[]) =>
    ncmApi<SongDetailResponse>("song_detail", { ids: ids.join(",") }),

  lyric: (id: number) => ncmApi<LyricResponse>("lyric", { id: String(id) }),
};
