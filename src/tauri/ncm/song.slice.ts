import {
  ncmAlbum,
  ncmCloudsearch,
  ncmLike,
  ncmLikelist,
  ncmLyric,
  ncmLyricNew,
  ncmRecordRecentSong,
  ncmSearchHot,
  ncmSearchSuggest,
  ncmSongDetail,
  ncmSongUrlV1,
} from './api';

export const songSlice = {
  search: (keywords: string, limit = 30, offset = 0) =>
    ncmCloudsearch({ keywords, searchType: 1, limit, offset }),

  searchAlbum: (keywords: string, limit = 30, offset = 0) =>
    ncmCloudsearch({ keywords, searchType: 10, limit, offset }),

  searchArtist: (keywords: string, limit = 30, offset = 0) =>
    ncmCloudsearch({ keywords, searchType: 100, limit, offset }),

  searchUser: (keywords: string, limit = 30, offset = 0) =>
    ncmCloudsearch({ keywords, searchType: 1002, limit, offset }),

  searchSuggest: (keywords: string) => ncmSearchSuggest({ keywords }),

  albumDetail: (id: number) => ncmAlbum({ id }),

  searchHot: () => ncmSearchHot(),

  songUrl: (id: number) => ncmSongUrlV1({ id, level: 'standard' }),

  songDetail: (ids: number[]) => ncmSongDetail({ ids }),

  lyric: (id: number) => ncmLyric({ id }),

  lyricNew: (id: number) => ncmLyricNew({ id }),

  like: (id: number, like = true) => ncmLike({ id, like }),

  likeList: (uid: number) => ncmLikelist({ uid }),

  recentSong: (uid: number) => ncmRecordRecentSong({ uid }),
};
