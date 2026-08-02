import type { AppearanceSettings, PlayerSettings } from '../types/settings';
import { WindowsEffect } from '../types/settings';

export const DEFAULTS_APPEARANCE: AppearanceSettings = {
  window_effect: WindowsEffect.mica,
  theme: 'system',
  close_behavior: 'quit',
};

export const DEFAULTS_PLAYER: PlayerSettings = {
  volume: 0.5,
  isMuted: false,
  playMode: 'order',
  playbackRate: 1,
};
