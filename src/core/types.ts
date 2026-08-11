import type { Song } from '@/shared/types/entities';

// ── Play mode ──

export const PlayModes = ['sequential', 'shuffle', 'repeatOne'] as const;
export type PlayMode = (typeof PlayModes)[number];

/** Cycle sequential → shuffle → repeatOne → sequential (pure). */
export function cyclePlayMode(mode: PlayMode): PlayMode {
  return mode === 'sequential'
    ? 'shuffle'
    : mode === 'shuffle'
      ? 'repeatOne'
      : 'sequential';
}

// ── Track model ──

/**
 * 队列歌曲：即 Rust 适配层统一 Song 实体（字段已由 Rust 归一）。
 * 使用 type-only import，不构成运行时跨层依赖。
 */
export type Track = Song;

