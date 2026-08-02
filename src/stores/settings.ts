import { cyclePlayMode } from '@/core/types';
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
import { createJSONStorage, persist } from 'zustand/middleware';
import { TauriStorage } from '@/tauri/storage';

type SettingsActions = {
  updateAppearance: (settings: Partial<AppearanceSettings>) => void;
  updatePlayer: (settings: Partial<PlayerSettings>) => void;
  cyclePlayMode: () => void;
  resetAll: () => void;
};

export const useSettingsStore = create<Settings & SettingsActions>()(
  persist(
    (set) => ({
      appearance: DEFAULTS_APPEARANCE,
      player: DEFAULTS_PLAYER,

      updateAppearance: (settings) =>
        set((state) => ({
          appearance: { ...state.appearance, ...settings },
        })),

      updatePlayer: (settings) =>
        set((state) => ({
          player: { ...state.player, ...settings },
        })),

      cyclePlayMode: () =>
        set((state) => ({
          player: {
            ...state.player,
            playMode: cyclePlayMode(state.player.playMode),
          },
        })),

      resetAll: () =>
        set({
          appearance: DEFAULTS_APPEARANCE,
          player: DEFAULTS_PLAYER,
        }),
    }),
    {
      name: 'settings',
      storage: createJSONStorage(() => TauriStorage),
      partialize: (state) => ({
        appearance: state.appearance,
        player: state.player,
      }),
      skipHydration: true,
    },
  ),
);
