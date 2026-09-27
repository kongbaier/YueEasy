// scroll-target 单元测试（纯逻辑，无 DOM 依赖）。
// 覆盖「播放行 → 视口目标行」的换算：跳空行、前奏落到第一句。

import { describe, expect, it } from 'vitest';
import type { LyricLine } from './parser';
import { computeScrollTargetLine } from './scroll-target';

/** 用文本建行：空字符串 = 只有时间戳的空行（间奏/伴奏占位） */
function lines(...texts: string[]): LyricLine[] {
  return texts.map((text, i) => ({
    startMs: i * 1000,
    durationMs: 1000,
    text,
  }));
}

describe('computeScrollTargetLine', () => {
  it('无歌词时返回 -1（调用方据此跳过定位）', () => {
    expect(computeScrollTargetLine(-1, [])).toBe(-1);
    expect(computeScrollTargetLine(3, [])).toBe(-1);
  });

  it('前奏（还没唱到词）提前落到第一句非空行', () => {
    expect(computeScrollTargetLine(-1, lines('第一句', '第二句'))).toBe(0);
    expect(computeScrollTargetLine(-1, lines('', '', '第一句'))).toBe(2);
  });

  it('正常行原样居中', () => {
    expect(computeScrollTargetLine(1, lines('a', 'b', 'c'))).toBe(1);
  });

  it('空行不居中：停在上一个非空行', () => {
    // 唱到第 2、3 行（间奏空行）时，视口停在上一句「b」
    expect(computeScrollTargetLine(2, lines('a', 'b', '', ''))).toBe(1);
    expect(computeScrollTargetLine(3, lines('a', 'b', '', ''))).toBe(1);
    // 空行两侧都有词时同样向前取
    expect(computeScrollTargetLine(2, lines('a', 'b', '', 'd'))).toBe(1);
  });

  it('空格/制表符也算空行', () => {
    expect(computeScrollTargetLine(1, lines('a', '   '))).toBe(0);
  });

  it('前面全是空行时向后取第一句非空', () => {
    expect(computeScrollTargetLine(1, lines('', '', 'c'))).toBe(2);
  });

  it('全篇皆空返回 -1', () => {
    expect(computeScrollTargetLine(1, lines('', ''))).toBe(-1);
    expect(computeScrollTargetLine(-1, lines('', ''))).toBe(-1);
  });

  it('行号越界（切歌瞬间的残留行号）不会取到不存在的行', () => {
    expect(computeScrollTargetLine(99, lines('a', 'b'))).toBe(1);
  });
});
