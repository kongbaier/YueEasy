import { Effect } from '../types/effect';
import type { AppearanceSettings } from '../types/settings';

export const DEFAULTS_APPEARANCE: AppearanceSettings = {
  windowEffect: Effect.Mica,
  theme: 'system',
  closeBehavior: 'quit',
};
