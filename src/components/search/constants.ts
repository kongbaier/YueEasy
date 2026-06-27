export const SKELETON_COUNT = 8;
export const GRID_SKELETON_COUNT = 12;

export const SEARCH_TABS = [
  { type: "1" as const, label: "单曲" },
  { type: "10" as const, label: "专辑" },
  { type: "100" as const, label: "歌手" },
  { type: "1002" as const, label: "用户" },
];

export type SearchTabType = (typeof SEARCH_TABS)[number]["type"];

export const TYPE_LABEL: Record<SearchTabType, string> = {
  "1": "歌曲",
  "10": "专辑",
  "100": "歌手",
  "1002": "用户",
};
