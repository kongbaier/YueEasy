import { ncmApi } from "./api";
import type {
  AlbumDetailResponse,
  LikeListResponse,
  LyricNewResponse,
  LyricResponse,
  RecentSongResponse,
  SearchAlbumResponse,
  SearchArtistResponse,
  SearchResponse,
  SearchSuggestResponse,
  SearchUserResponse,
  SongDetailResponse,
  SongUrlResponse,
} from "./types";

export type {
  LikeListResponse,
  LyricNewResponse,
  LyricResponse,
  RecentSongResponse,
  SearchAlbumResponse,
  SearchArtistResponse,
  SearchResponse,
  SearchUserResponse,
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

  searchAlbum: (keywords: string, limit = 30, offset = 0) =>
    ncmApi<SearchAlbumResponse>("cloudsearch", {
      keywords,
      type: "10",
      limit: String(limit),
      offset: String(offset),
    }),

  searchArtist: (keywords: string, limit = 30, offset = 0) =>
    ncmApi<SearchArtistResponse>("cloudsearch", {
      keywords,
      type: "100",
      limit: String(limit),
      offset: String(offset),
    }),

  searchUser: (keywords: string, limit = 30, offset = 0) =>
    ncmApi<SearchUserResponse>("cloudsearch", {
      keywords,
      type: "1002",
      limit: String(limit),
      offset: String(offset),
    }),

  searchSuggest: (keywords: string) =>
    ncmApi<SearchSuggestResponse>("search/suggest", { keywords }),

  albumDetail: (id: number) =>
    ncmApi<AlbumDetailResponse>("album", { id: String(id) }),

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

  lyricNew: (id: number) =>
    ncmApi<LyricNewResponse>("lyric_new", { id: String(id) }),

  like: (id: number, like = true) =>
    ncmApi<unknown>("like", { id: String(id), like: like ? "true" : "false" }),

  likeList: (uid: number) =>
    ncmApi<LikeListResponse>("likelist", { uid: String(uid) }),

  recentSong: (uid: number) =>
    ncmApi<RecentSongResponse>("record/recent/song", { uid: String(uid) }),
};
