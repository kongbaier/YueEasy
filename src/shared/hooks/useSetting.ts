import type { AppearanceSettings } from '@/shared/types/settings';
import { useSettingsStore } from '@/stores/settings';

/** 统一设置读取。组件层唯一入口。
 * 数据流：typed hook → useSettingsStore.appearance (typed)
 *        → updateAppearance → zustand set → persist → TauriStorage 异步持久化 */
export function useAppearanceSetting<K extends keyof AppearanceSettings>(
  key: K,
): [AppearanceSettings[K], (value: AppearanceSettings[K]) => void] {
  const value = useSettingsStore((s) => s.appearance[key]);
  const setValue = (v: AppearanceSettings[K]) => {
    useSettingsStore.getState().updateAppearance({ [key]: v } as Partial<AppearanceSettings>);
  };
  return [value, setValue];
}
