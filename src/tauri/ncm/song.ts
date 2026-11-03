// NCM 歌曲/搜索域 IPC 入口（infra 层）。
// 每个函数 = 一次 invoke 封装；返回值即 Rust 侧产出的 Ui Model。

import { invoke } from '@tauri-apps/api/core';
import type {
  AlbumDetail,
  HotSearchItem,
  KeywordSuggest,
  LikeList,
  Lyric,
  RecentSongs,
  SearchResult,
  Song,
  SongUrlResult,
} from '@/shared/types/uiModels';

export const search = (
  keywords: string,
  limit = 30,
  offset = 0,
): Promise<SearchResult> =>
  invoke<SearchResult>('ncm_cloudsearch', {
    keywords,
    searchType: 1,
    limit,
    offset,
  });

export const searchAlbum = (
  keywords: string,
  limit = 30,
  offset = 0,
): Promise<SearchResult> =>
  invoke<SearchResult>('ncm_cloudsearch', {
    keywords,
    searchType: 10,
    limit,
    offset,
  });

export const searchArtist = (
  keywords: string,
  limit = 30,
  offset = 0,
): Promise<SearchResult> =>
  invoke<SearchResult>('ncm_cloudsearch', {
    keywords,
    searchType: 100,
    limit,
    offset,
  });

export const searchUser = (
  keywords: string,
  limit = 30,
  offset = 0,
): Promise<SearchResult> =>
  invoke<SearchResult>('ncm_cloudsearch', {
    keywords,
    searchType: 1002,
    limit,
    offset,
  });

export const searchSuggestKeyword = (
  keywords: string,
): Promise<KeywordSuggest[]> =>
  invoke<KeywordSuggest[]>('ncm_search_suggest_keyword', { keywords });

export const albumDetail = (id: number): Promise<AlbumDetail> =>
  invoke<AlbumDetail>('ncm_album', { id });

export const searchHot = (): Promise<HotSearchItem[]> =>
  invoke<HotSearchItem[]>('ncm_search_hot');

export const songUrl = (id: number): Promise<SongUrlResult> =>
  invoke<SongUrlResult>('ncm_song_url_v1', { id, level: 'standard' });

export const songDetail = (ids: number[]): Promise<Song[]> =>
  invoke<Song[]>('ncm_song_detail', { ids });

export const lyric = (id: number): Promise<Lyric> =>
  invoke<Lyric>('ncm_lyric', { id });

export const lyricNew = (id: number): Promise<Lyric> =>
  invoke<Lyric>('ncm_lyric_new', { id });

export const like = (id: number, liked = true): Promise<void> =>
  invoke<void>('ncm_like', { id, like: liked });

export const likeList = (uid: number): Promise<LikeList> =>
  invoke<LikeList>('ncm_likelist', { uid });

export const recentSong = (uid: number): Promise<RecentSongs> =>
  invoke<RecentSongs>('ncm_record_recent_song', { uid });

/**
 * 听歌上报（写入云端「最近听过」）。
 *
 * 走桌面端的 clientlog eapi `startplay` 日志（Rust 侧封装）；`sourceId` 是来源歌单 / 专辑 id。
 * 未登录时后端会返回业务错误，调用方应自行按登录态门禁。
 */
export const scrobble = (id: number, sourceId = 0): Promise<void> =>
  invoke<void>('ncm_scrobble', { id, sourceId });
