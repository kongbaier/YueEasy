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

  const yrc = data.yrc;

  return {
    lyric: data.lrc?.lyric && !yrc ? parseLrc(data.lrc.lyric) : [],
    tlyric: data.tlyric?.lyric ? parseLrc(data.tlyric.lyric) : [],
    yrc: yrc ? parseYrc(yrc.lyric) : [],
  };
}
