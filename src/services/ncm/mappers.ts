import type { Playlist, SongRef } from "@/core/playlist/types";
import type {
  PersonalizedPlaylist,
  TopPlaylist,
} from "./types/playlist.response";
import type { NcmSong } from "./types/song.response";

export function toPlaylist(p: PersonalizedPlaylist): Playlist;
export function toPlaylist(p: TopPlaylist): Playlist;
export function toPlaylist(p: PersonalizedPlaylist | TopPlaylist): Playlist {
  return {
    id: p.id,
    name: p.name,
    coverUrl: "picUrl" in p ? p.picUrl : p.coverImgUrl,
    trackCount: p.trackCount,
    playCount: p.playCount,
    description: "creator" in p ? p.description : undefined,
    creator: "creator" in p ? p.creator : undefined,
    tags: "tags" in p ? p.tags : undefined,
  };
}

export function toSongRef(s: NcmSong): SongRef {
  return {
    id: s.id,
    name: s.name,
    artists: s.ar ?? [],
    album: s.al ?? { id: 0, name: "", picUrl: "" },
    duration: s.dt,
    fee: s.fee,
  };
}
