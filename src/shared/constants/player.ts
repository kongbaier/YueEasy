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
};
