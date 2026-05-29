import type { Track as PlayerTrack } from "@/core/player/types";
import type { Track } from "@/types/music";
import { ncm } from "./ncm";

export async function resolveTrack(track: Track): Promise<PlayerTrack> {
  const result = await ncm.songUrl(track.id);
  const url = result.data?.[0]?.url || "";
  if (!url) {
    throw new Error("无法解析播放地址");
  }
  return {
    id: track.id,
    name: track.name,
    artists: (track.ar || []).map((a) => ({ id: a.id, name: a.name })),
    album: track.al
      ? { id: track.al.id, name: track.al.name, picUrl: track.al.picUrl }
      : { id: 0, name: "" },
    duration: track.dt,
    url,
  };
}
