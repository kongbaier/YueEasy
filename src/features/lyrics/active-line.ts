import type { LyricLine } from './parser';

/**
 * 由播放时间算出「哪句在唱」的行号（纯函数，无副作用）。
 *
 * 主窗口歌词列表（`useLyrics`）与桌面歌词窗口共用同一套判定：
 * 取最后一句 startMs 已到达的行；还没到第一句时返回 -1。
 */
export function computeActiveLine(
  currentTimeSec: number,
  lines: LyricLine[],
): number {
  if (lines.length === 0) return -1;

  const ms = currentTimeSec * 1000;

  // Reverse scan for the last line whose start is reached
  for (let i = lines.length - 1; i >= 0; i--) {
    if (ms >= lines[i].startMs) return i;
  }

  return -1;
}
