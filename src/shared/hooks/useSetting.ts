import type {
  AppearanceSettings,
} from "@/shared/types/settings";
import { useAppSettings } from "@/stores/settings";

/**
 * 统一设置读写。组件层唯一入口。
 *
 * 数据流：
 *   typed hook → useAppSettings.settings (typed Settings)
 *              → mergeSetting → Store.set → Store.save (tauri-plugin-store)
 *
 * 组件 set → store settings 立即更新 (zustand 通知重渲染)
 *          → Store 异步持久化到 settings.json
 */

/** Appearance 域设置，读写均强类型 */
export function useAppearanceSetting<K extends keyof AppearanceSettings>(
  key: K,
): [AppearanceSettings[K], (value: AppearanceSettings[K]) => void] {
  const value = useAppSettings((s) => s.settings[key]);
  const merge = useAppSettings((s) => s.mergeSetting);
  const setValue = (v: AppearanceSettings[K]) => {
    merge({ [key]: v } as Partial<{
      [K in keyof AppearanceSettings]: AppearanceSettings[K];
    }>);
  };
  return [value, setValue];
}
