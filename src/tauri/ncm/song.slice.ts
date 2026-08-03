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
import type {
  AlbumDetailResponse,
  LikeListResponse,
  LyricNewResponse,
  LyricResponse,
  RecentSongResponse,
  SearchAlbumResponse,
  SearchArtistResponse,
  SearchHotResponse,
  SearchResponse,
  SearchSuggestResponse,
  SearchUserResponse,
  SongDetailResponse,
  SongUrlResponse,
} from './types';

export const songSlice = {
  search: (keywords: string, limit = 30, offset = 0) =>
    ncmCloudsearch<SearchResponse>({ keywords, searchType: 1, limit, offset }),

  searchAlbum: (keywords: string, limit = 30, offset = 0) =>
    ncmCloudsearch<SearchAlbumResponse>({
      keywords,
      searchType: 10,
      limit,
      offset,
    }),

  searchArtist: (keywords: string, limit = 30, offset = 0) =>
    ncmCloudsearch<SearchArtistResponse>({
      keywords,
      searchType: 100,
      limit,
      offset,
    }),

  searchUser: (keywords: string, limit = 30, offset = 0) =>
    ncmCloudsearch<SearchUserResponse>({
      keywords,
      searchType: 1002,
      limit,
      offset,
    }),

  searchSuggest: (keywords: string) =>
    ncmSearchSuggest<SearchSuggestResponse>({ keywords }),

  albumDetail: (id: number) => ncmAlbum<AlbumDetailResponse>({ id }),

  searchHot: () => ncmSearchHot<SearchHotResponse>(),

  songUrl: (id: number) =>
    ncmSongUrlV1<SongUrlResponse>({ id, level: 'standard' }),

  songDetail: (ids: number[]) =>
    ncmSongDetail<SongDetailResponse>({ ids }),

  lyric: (id: number) => ncmLyric<LyricResponse>({ id }),

  lyricNew: (id: number) => ncmLyricNew<LyricNewResponse>({ id }),

  like: (id: number, like = true) => ncmLike({ id, like }),

  likeList: (uid: number) => ncmLikelist<LikeListResponse>({ uid }),

  recentSong: (uid: number) =>
    ncmRecordRecentSong<RecentSongResponse>({ uid }),
};
