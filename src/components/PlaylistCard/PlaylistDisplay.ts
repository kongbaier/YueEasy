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
}

export function toPlaylistDisplay(p: PersonalizedPlaylist): PlaylistDisplay;
export function toPlaylistDisplay(p: TopPlaylist): PlaylistDisplay;
export function toPlaylistDisplay(p: Playlist): PlaylistDisplay;
export function toPlaylistDisplay(item: {
  id: number;
  name: string;
  playCount: number;
  coverUrl?: string;
  picUrl?: string;
  coverImgUrl?: string;
}): PlaylistDisplay {
  return {
    id: item.id,
    name: item.name,
    coverUrl: item.coverUrl ?? item.coverImgUrl ?? item.picUrl ?? "",
    playCount: item.playCount,
  };
}
