import type { Effect } from "@tauri-apps/api/window";

export type Theme = "light" | "dark" | "system";
export type CloseBehavior = "quit" | "hide";
export type WindowsEffect =
  | Effect.Mica
  | Effect.Tabbed
  | Effect.Acrylic
  | Effect.Blur;

export interface AppearanceSettings {
  theme: Theme;
  window_effect: WindowsEffect;
  close_behavior: CloseBehavior;
}

export type Settings = AppearanceSettings;
