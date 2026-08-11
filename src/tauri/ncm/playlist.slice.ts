import {
  ncmPersonalized,
  ncmPlaylistDetail,
  ncmPlaylistHot,
  ncmRecommendResource,
  ncmTopPlaylist,
  ncmUserPlaylist,
} from './api';

export const playlistSlice = {
  playlistDetail: (id: number) => ncmPlaylistDetail({ id }),

  userPlaylist: (uid: number) => ncmUserPlaylist({ uid }),

  personalizedPlaylist: (limit = 30) => ncmPersonalized({ limit }),

  topPlaylist: (cat = '全部', limit = 30, offset = 0) =>
    ncmTopPlaylist({ cat, limit, offset }),

  playlistRecommend: () => ncmRecommendResource(),

  playlistHot: () => ncmPlaylistHot(),
};
