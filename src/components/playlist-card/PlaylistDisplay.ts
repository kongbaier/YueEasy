import type { Playlist } from "@/core/playlist/types";
import type {
  PersonalizedPlaylist,
  TopPlaylist,
} from "@/services/ncm/types/playlist.response";

/** 歌单卡片展示值对象 —— 纯展示关注点，与业务模型解耦 */
export interface PlaylistDisplay {
  id: number;
  name: string;
  coverUrl: string;
  playCount: number;
  trackCount: number;
  creator: string;
  description?: string;
}

export function toPlaylistDisplay(p: PersonalizedPlaylist): PlaylistDisplay;
export function toPlaylistDisplay(p: TopPlaylist): PlaylistDisplay;
export function toPlaylistDisplay(p: Playlist): PlaylistDisplay;
export function toPlaylistDisplay(item: {
  id: number;
  name: string;
  playCount: number;
  trackCount?: number;
  coverUrl?: string;
  picUrl?: string;
  coverImgUrl?: string;
  creator?: { nickname: string };
  description?: string;
}): PlaylistDisplay {
  return {
    id: item.id,
    name: item.name,
    coverUrl: item.coverUrl ?? item.coverImgUrl ?? item.picUrl ?? "",
    playCount: item.playCount,
    trackCount: (item as { trackCount?: number }).trackCount ?? 0,
    creator: (item as { creator?: { nickname: string } }).creator?.nickname ?? "",
    description: (item as { description?: string }).description ?? "",
  };
}
