import { ncmApi } from "./api";
import type {
  LikeListResponse,
  LyricResponse,
  RecentSongResponse,
  SearchResponse,
  SongDetailResponse,
  SongUrlResponse,
} from "./types";

export type {
  LikeListResponse,
  LyricResponse,
  RecentSongResponse,
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

  searchHot: () =>
    ncmApi<{
      result: {
        hots: { first: string; iconType: number; second: number }[];
      };
    }>("search/hot"),

  songUrl: (id: number) =>
    ncmApi<SongUrlResponse>("song_url_v1", {
      id: String(id),
      level: "standard",
    }),

  songDetail: (ids: number[]) =>
    ncmApi<SongDetailResponse>("song_detail", { ids: ids.join(",") }),

  lyric: (id: number) => ncmApi<LyricResponse>("lyric", { id: String(id) }),

  like: (id: number, like = true) =>
    ncmApi<unknown>("like", { id: String(id), like: like ? "true" : "false" }),

  likeList: (uid: number) =>
    ncmApi<LikeListResponse>("likelist", { uid: String(uid) }),

  recentSong: (uid: number) =>
    ncmApi<RecentSongResponse>("record/recent/song", { uid: String(uid) }),
};
