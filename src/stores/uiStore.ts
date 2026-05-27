import { create } from "zustand";

type Theme = "light" | "dark";

interface UiStore {
  sidebarCollapsed: boolean;
  theme: Theme;
  ncmReady: boolean;
  toggleSidebar: () => void;
  setTheme: (theme: Theme) => void;
  setNcmReady: (ready: boolean) => void;
}

export const useUiStore = create<UiStore>((set) => ({
  sidebarCollapsed: false,
  theme: "dark" as Theme,
  ncmReady: false,

  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setTheme: (theme) => set({ theme }),
  setNcmReady: (ready) => set({ ncmReady: ready }),
}));
