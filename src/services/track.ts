import type { Track as PlayerTrack } from "@/core/player/types";
import type { SongRef } from "@/core/playlist/types";
import { ncm } from "./ncm";

export async function resolveTrack(track: SongRef): Promise<PlayerTrack> {
  const result = await ncm.songUrl(track.id);
  const url = result.data?.[0]?.url || "";
  if (!url) {
    throw new Error("无法解析播放地址");
  }
  return {
    id: track.id,
    name: track.name,
    artists: track.artists.map((a) => ({ id: a.id, name: a.name })),
    album: {
      id: track.album.id,
      name: track.album.name,
      picUrl: track.album.picUrl,
    },
    duration: track.duration,
    url,
  };
}
