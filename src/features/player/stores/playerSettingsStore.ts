import { create } from 'zustand';
import { DEFAULTS_PLAYER } from '@/shared/constants/player';
import type { PlayerSettings } from '@/shared/types/settings';

// playerSettingsStore —— 播放器偏好运行时状态（纯状态容器，无持久化）。
//
// 持久化由 shared/services/SettingsService 独占。播放器域内消费（PlayerService / usePlayer），
// 启动时 app 壳读它下发音量到 audioCore。

export interface PlayerSettingsStore {
  player: PlayerSettings;
  updatePlayer: (settings: Partial<PlayerSettings>) => void;
}

export const usePlayerSettingsStore = create<PlayerSettingsStore>()((set) => ({
  player: DEFAULTS_PLAYER,

  updatePlayer: (settings) =>
    set((state) => ({
      player: { ...state.player, ...settings },
    })),
}));
