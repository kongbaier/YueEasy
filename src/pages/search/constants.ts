import type { Album, Artist, Song, User } from '@/shared/types/entities';

export const SKELETON_COUNT = 8;
export const GRID_SKELETON_COUNT = 12;

export enum SearchType {
  SONG = '1',
  ALBUM = '10',
  ARTIST = '100',
  USER = '1002',
}

export const SEARCH_TABS = [
  { type: SearchType.SONG, label: '单曲' },
  { type: SearchType.ALBUM, label: '专辑' },
  { type: SearchType.ARTIST, label: '歌手' },
  { type: SearchType.USER, label: '用户' },
];

export const TYPE_LABEL: Record<SearchType, string> = {
  [SearchType.SONG]: '歌曲',
  [SearchType.ALBUM]: '专辑',
  [SearchType.ARTIST]: '歌手',
  [SearchType.USER]: '用户',
};

export interface SuggestionItem {
  /** 实体 id（与 kind 组合后唯一） */
  id: number;
  /** 展示文本（含副标题，如 "七里香 — 周杰伦"） */
  label: string;
  /** 点击后填入搜索框的关键词 */
  keyword: string;
  /** 类型：歌曲 / 专辑 / 歌手 */
  kind: 'song' | 'album' | 'artist';
}

/**
 * 建议项唯一标识：列表 key 与去重共用。
 * 必须带 kind 前缀——歌曲 / 专辑 / 歌手的 id 各自独立编号，会重号。
 * 不能用 label：同名专辑 / 同名歌曲的 label 完全相同。
 */
export const suggestionKey = (item: SuggestionItem) =>
  `${item.kind}:${item.id}`;

/** 各搜索分类对应的实体类型 */
export interface SearchEntityMap {
  [SearchType.SONG]: Song;
  [SearchType.ALBUM]: Album;
  [SearchType.ARTIST]: Artist;
  [SearchType.USER]: User;
}

/**
 * 搜索结果：`type` 与 `items` 绑定为判别式联合，
 * 消费方按 `type` 收窄即可拿到对应实体，无需断言。
 */
export type SearchResults = {
  [K in SearchType]: { type: K; items: SearchEntityMap[K][] };
}[SearchType];
