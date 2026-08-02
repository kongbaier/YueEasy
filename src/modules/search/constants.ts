export const SKELETON_COUNT = 8;
export const GRID_SKELETON_COUNT = 12;

export enum SearchType {
  SONG = "1",
  ALBUM = "10",
  ARTIST = "100",
  USER = "1002",
}

export const SEARCH_TABS = [
  { type: SearchType.SONG, label: "单曲" },
  { type: SearchType.ALBUM, label: "专辑" },
  { type: SearchType.ARTIST, label: "歌手" },
  { type: SearchType.USER, label: "用户" },
];

export const TYPE_LABEL: Record<SearchType, string> = {
  [SearchType.SONG]: "歌曲",
  [SearchType.ALBUM]: "专辑",
  [SearchType.ARTIST]: "歌手",
  [SearchType.USER]: "用户",
};
