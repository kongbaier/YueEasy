import { Effect } from "@tauri-apps/api/window";
import { create } from "zustand";
import { setWindowEffect } from "@/shared/services/effect";
import { loadAllEntries, setStoreValue } from "@/shared/services/store";
import type {
  AppearanceSettings,
  Settings,
} from "@/shared/types/settings";

export const APPEARANCE_DEFAULTS: AppearanceSettings = {
  theme: "system",
  window_effect: Effect.Mica,
  close_behavior: "quit",
};

const DEFAULTS: Settings = { ...APPEARANCE_DEFAULTS };

async function loadSettings(): Promise<Settings> {
  const settings = await loadAllEntries<Settings>();
  return {
    ...DEFAULTS,
    ...settings,
  };
}

interface SettingStore {
  settings: Settings;
  ready: boolean;

  init: () => Promise<void>;
  mergeSetting: (partial: Partial<Settings>) => void;
}

export const useAppSettings = create<SettingStore>((set) => ({
  settings: { ...DEFAULTS },
  ready: false,

  init: async () => {
    const settings = await loadSettings();
    set({ settings, ready: true });
    await setWindowEffect(settings.window_effect);
  },

  mergeSetting: (partial) => {
    set((store) => ({ settings: { ...store.settings, ...partial } }));
    for (const [key, value] of Object.entries(partial)) {
      setStoreValue(key, value);
    }
  },
}));
