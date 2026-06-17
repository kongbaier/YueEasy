import type { LyricLine } from "@/core/lyrics/parser";
import { parseLrc, parseYrc } from "@/core/lyrics/parser";
import { ncm } from "./ncm";

export interface LyricsResult {
  lyric: LyricLine[];
  tlyric: LyricLine[];
  yrc: LyricLine[];
}

export async function fetchLyrics(trackId: number): Promise<LyricsResult> {
  const data = await ncm.lyricNew(trackId);

  const hasYrc = !!(data.yrc?.lyric);

  return {
    lyric: data.lrc?.lyric && !hasYrc ? parseLrc(data.lrc.lyric) : [],
    tlyric: data.tlyric?.lyric ? parseLrc(data.tlyric.lyric) : [],
    yrc: hasYrc ? parseYrc(data.yrc!.lyric) : [],
  };
}
