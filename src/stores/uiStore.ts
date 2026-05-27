import { create } from "zustand";

type Theme = "light" | "dark";

interface UiStore {
  theme: Theme;
  ncmReady: boolean;
  setTheme: (theme: Theme) => void;
  setNcmReady: (ready: boolean) => void;
}

export const useUiStore = create<UiStore>((set) => ({
  theme: "dark" as Theme,
  ncmReady: false,

  setTheme: (theme) => set({ theme }),
  setNcmReady: (ready) => set({ ncmReady: ready }),
}));
