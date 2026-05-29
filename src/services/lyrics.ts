import type { LyricLine } from "@/core/lyrics/parser";
import { parseLrc } from "@/core/lyrics/parser";
import { ncm } from "./ncm";

export interface LyricsResult {
  lyric: LyricLine[];
  tlyric: LyricLine[];
}

export async function fetchLyrics(trackId: number): Promise<LyricsResult> {
  const data = await ncm.lyric(trackId);
  return {
    lyric: data.lrc?.lyric ? parseLrc(data.lrc.lyric) : [],
    tlyric: data.tlyric?.lyric ? parseLrc(data.tlyric.lyric) : [],
  };
}
