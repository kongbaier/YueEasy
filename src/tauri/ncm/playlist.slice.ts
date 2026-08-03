import {
  ncmPersonalized,
  ncmPlaylistDetail,
  ncmPlaylistHot,
  ncmRecommendResource,
  ncmTopPlaylist,
  ncmUserPlaylist,
} from './api';
import type {
  PersonalizedResponse,
  PlaylistDetailResponse,
  PlaylistRecommendResponse,
  TopPlaylistResponse,
  UserPlaylistResponse,
} from './types';

export type {
  PersonalizedResponse,
  PlaylistDetailResponse,
  PlaylistRecommendResponse,
  TopPlaylistResponse,
  UserPlaylistResponse,
} from './types';

export const playlistSlice = {
  playlistDetail: (id: number) =>
    ncmPlaylistDetail<PlaylistDetailResponse>({ id }),

  userPlaylist: (uid: number) =>
    ncmUserPlaylist<UserPlaylistResponse>({ uid }),

  personalizedPlaylist: (limit = 30) =>
    ncmPersonalized<PersonalizedResponse>({ limit }),

  topPlaylist: (cat = '全部', limit = 30, offset = 0) =>
    ncmTopPlaylist<TopPlaylistResponse>({ cat, limit, offset }),

  playlistRecommend: () =>
    ncmRecommendResource<PlaylistRecommendResponse>(),

  playlistHot: () => ncmPlaylistHot(),
};
