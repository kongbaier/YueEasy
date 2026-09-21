import type { LyricLine } from '@/features/lyrics/parser';
import { parseLrc, parseYrc } from '@/features/lyrics/parser';
import { ncm } from '@/tauri/ncm';

export interface LyricsResult {
  lyric: LyricLine[];
  tlyric: LyricLine[];
  yrc: LyricLine[];
}

export async function fetchLyrics(trackId: number): Promise<LyricsResult> {
  const data = await ncm.lyricNew(trackId);

  const yrc = data.yrc;

  return {
    lyric: data.lrc?.text && !yrc ? parseLrc(data.lrc.text) : [],
    tlyric: data.tlyric?.text ? parseLrc(data.tlyric.text) : [],
    yrc: yrc ? parseYrc(yrc.text) : [],
  };
}
