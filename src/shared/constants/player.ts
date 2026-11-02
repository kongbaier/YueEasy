import type { RepeatMode } from '@/shared/types/player';
import type { PlayerSettings } from '../types/settings';

/** 终止策略循环：off → all → one → off。仅当 content_source == queue 时生效。 */
export const NEXT_REPEAT: Record<RepeatMode, RepeatMode> = {
  off: 'all',
  all: 'one',
  one: 'off',
};

export const DEFAULTS_PLAYER: PlayerSettings = {
  volume: 0.5,
  isMuted: false,
  playbackRate: 1,
  savePlaybackHistory: true,
  // 2GB：320kbps 约 200 首 / 128kbps 约 500 首，兼顾「够用」与「不抢磁盘」
  audioCacheLimitMB: 2048,
};

/** 音频缓存上限候选值（MB）：`0` = 关闭。 */
export const AUDIO_CACHE_LIMIT_OPTIONS = [0, 512, 1024, 2048, 4096, 8192] as const;
