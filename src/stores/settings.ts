import {
  DEFAULTS_APPEARANCE,
  DEFAULTS_PLAYER,
} from '@/shared/constants/settings';
import type {
  AppearanceSettings,
  PlayerSettings,
  Settings,
} from '@/shared/types/settings';
import { create } from 'zustand';

type SettingsActions = {
  loadAll: (settings: Partial<Settings>) => void;
  updateAppearance: (settings: Partial<AppearanceSettings>) => void;
  updatePlayer: (settings: Partial<PlayerSettings>) => void;
  resetAll: () => void;
};

export const useSettingsStore = create<Settings & SettingsActions>((set) => ({
  appearance: DEFAULTS_APPEARANCE,
  player: DEFAULTS_PLAYER,

  loadAll: (settings) =>
    set((state) => ({
      appearance: { ...state.appearance, ...settings.appearance },
      player: { ...state.player, ...settings.player },
    })),

  updateAppearance: (settings) =>
    set((state) => ({
      appearance: { ...state.appearance, ...settings },
    })),

  updatePlayer: (settings) =>
    set((state) => ({
      player: { ...state.player, ...settings },
    })),

  resetAll: () =>
    set({
      appearance: DEFAULTS_APPEARANCE,
      player: DEFAULTS_PLAYER,
    }),
}));
