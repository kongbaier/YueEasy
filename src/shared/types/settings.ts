import { Effect } from '@tauri-apps/api/window';

export type Theme = 'light' | 'dark' | 'system';
export type CloseBehavior = 'quit' | 'hide';

export enum WindowsEffect {
  mica = Effect.Mica,
  tabbed = Effect.Tabbed,
  acrylic = Effect.Acrylic,
  blur = Effect.Blur,
}

export interface AppearanceSettings {
  theme: Theme;
  window_effect: WindowsEffect;
  close_behavior: CloseBehavior;
}

export interface PlayerSettings {
  volume: number;
  isMuted: boolean;
  playbackRate: number;
}

export type Settings = {
  appearance: AppearanceSettings;
  player: PlayerSettings;
};
