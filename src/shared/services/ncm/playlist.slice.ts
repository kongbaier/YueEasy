import { ncmApi } from "./api";
import type {
  PersonalizedResponse,
  PlaylistDetailResponse,
  PlaylistRecommendResponse,
  TopPlaylistResponse,
  UserPlaylistResponse,
} from "./types";

export type {
  PersonalizedResponse,
  PlaylistDetailResponse,
  PlaylistRecommendResponse,
  TopPlaylistResponse,
  UserPlaylistResponse,
} from "./types";

export const playlistSlice = {
  playlistDetail: (id: number) =>
    ncmApi<PlaylistDetailResponse>("playlist_detail", { id: String(id) }),

  userPlaylist: (uid: number) =>
    ncmApi<UserPlaylistResponse>("user_playlist", { uid: String(uid) }),

  personalizedPlaylist: (limit = 30) =>
    ncmApi<PersonalizedResponse>("personalized", {
      limit: String(limit),
    }),

  topPlaylist: (cat = "全部", limit = 30, offset = 0) =>
    ncmApi<TopPlaylistResponse>("top_playlist", {
      cat,
      limit: String(limit),
      offset: String(offset),
    }),

  playlistRecommend: () =>
    ncmApi<PlaylistRecommendResponse>("recommend_resource"),

  playlistHot: () => ncmApi<unknown>("playlist_hot"),
};
