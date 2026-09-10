import { create } from 'zustand';
import { DEFAULTS_APPEARANCE } from '@/shared/constants/settings';
import type { AppearanceSettings } from '@/shared/types/settings';

// appSettingsStore —— 应用外观运行时状态（纯状态容器，无持久化）。
//
// 持久化由 shared/services/SettingsService 独占（load 播种 / 变更订阅回写），本 store 不挂 persist。
// 跨域消费：app 壳（useThemeSync / useWindowState）+ 设置页（经 useAppearanceSetting）。

export interface AppSettingsStore {
  appearance: AppearanceSettings;
  updateAppearance: (settings: Partial<AppearanceSettings>) => void;
}

export const useAppSettingsStore = create<AppSettingsStore>()((set) => ({
  appearance: DEFAULTS_APPEARANCE,

  updateAppearance: (settings) =>
    set((state) => ({
      appearance: { ...state.appearance, ...settings },
    })),
}));
