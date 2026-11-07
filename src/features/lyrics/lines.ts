import type { LyricsResult } from './lyrics-service';
import type { LyricLine } from './parser';

export interface ResolvedLyricLines {
  /** 主歌词（逐字优先，其次普通歌词，最后退到翻译） */
  lines: LyricLine[];
  /** 与 `lines` 按下标对齐的翻译文本（没有翻译 / 主歌词就是翻译时为空数组） */
  translations: string[];
  hasYrc: boolean;
}

/**
 * 一份曲目歌词数据 → 「渲染哪一组行」。
 *
 * 主窗口歌词页与桌面歌词窗口共用：逐字（yrc）优先，否则普通歌词，
 * 两者都没有时才拿翻译当主歌词（此时不再重复显示翻译）。
 */
export function resolveLyricLines(
  result: LyricsResult | undefined,
): ResolvedLyricLines {
  const yrc = result?.yrc ?? [];
  const lyric = result?.lyric ?? [];
  const tlyric = result?.tlyric ?? [];

  const hasYrc = yrc.length > 0;
  const main = hasYrc ? yrc : lyric;
  const lines = main.length > 0 ? main : tlyric;
  const translations =
    lines === tlyric ? [] : lines.map((_, i) => tlyric[i]?.text ?? '');

  return { lines, translations, hasYrc };
}
