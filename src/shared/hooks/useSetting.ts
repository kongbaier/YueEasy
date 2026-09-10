import type {
  AppearanceSettings,
  PlayerSettings,
} from '@/shared/types/settings';
import { useAppSettingsStore } from '@/stores/appSettingsStore';
import { usePlayerSettingsStore } from '@/modules/player/stores/playerSettingsStore';

/** 统一设置读取。组件层唯一入口。
 * 数据流：typed hook → useAppSettingsStore.appearance (typed)
 *        → updateAppearance → zustand set → SettingsService 订阅回写 TauriStorage */
export function useAppearanceSetting<K extends keyof AppearanceSettings>(
  key: K,
): [AppearanceSettings[K], (value: AppearanceSettings[K]) => void] {
  const value = useAppSettingsStore((s) => s.appearance[key]);
  const setValue = (v: AppearanceSettings[K]) => {
    useAppSettingsStore
      .getState()
      .updateAppearance({ [key]: v } as Partial<AppearanceSettings>);
  };
  return [value, setValue];
}

/** 播放器设置读取（与 useAppearanceSetting 对称）。 */
export function usePlayerSetting<K extends keyof PlayerSettings>(
  key: K,
): [PlayerSettings[K], (value: PlayerSettings[K]) => void] {
  const value = usePlayerSettingsStore((s) => s.player[key]);
  const setValue = (v: PlayerSettings[K]) => {
    usePlayerSettingsStore
      .getState()
      .updatePlayer({ [key]: v } as Partial<PlayerSettings>);
  };
  return [value, setValue];
}
