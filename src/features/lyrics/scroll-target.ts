import type { LyricLine } from './parser';

/** 空行：只有时间戳、没有歌词文本（间奏/伴奏占位） */
function isBlankLine(line: LyricLine | undefined): boolean {
  return !line || line.text.trim().length === 0;
}

/**
 * 播放行（activeLine，答「哪句在唱」）→ 视口目标行（答「视口该停在哪句」）。
 *   - 空行不居中：唱到间奏空行时停在上一个非空行，视图不跟着空行跳；
 *   - 前奏提前落到第一句：还没唱到词就把视口定到第一句，而不是留在列表顶端。
 *
 * 纯函数、无依赖：视口位移（useLyricScroll）只认行号，播放行到目标行的换算属于歌词域知识。
 * 全篇皆空（或还没有歌词）返回 -1 —— 调用方据此跳过定位。
 */
export function computeScrollTargetLine(
  activeLine: number,
  lines: LyricLine[],
): number {
  if (lines.length === 0) return -1;

  if (activeLine < 0) {
    return lines.findIndex((line) => !isBlankLine(line));
  }

  const from = Math.min(activeLine, lines.length - 1);
  // 向前找最近的非空行
  for (let i = from; i >= 0; i--) {
    if (!isBlankLine(lines[i])) return i;
  }
  // 前面全是空行（极少见）：向后取第一句非空
  for (let i = from + 1; i < lines.length; i++) {
    if (!isBlankLine(lines[i])) return i;
  }
  return -1;
}
