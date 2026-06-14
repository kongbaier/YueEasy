import { create } from "zustand";

export type Theme = "light" | "dark" | "system";

function getStoredTheme(): Theme {
  if (typeof window === "undefined") return "system";
  const stored = localStorage.getItem("theme");
  if (stored === "light" || stored === "dark" || stored === "system")
    return stored;
  return "system";
}

interface UiStore {
  theme: Theme;
  loginDialogOpen: boolean;
  isMaximized: boolean;
  setTheme: (theme: Theme) => void;
  setLoginDialogOpen: (open: boolean) => void;
  setMaximized: (maximized: boolean) => void;
}

export const useUiStore = create<UiStore>((set) => ({
  theme: getStoredTheme(),
  loginDialogOpen: false,
  isMaximized: false,

  setTheme: (theme) => {
    localStorage.setItem("theme", theme);
    set({ theme });
  },
  setLoginDialogOpen: (open) => set({ loginDialogOpen: open }),
  setMaximized: (maximized) => set({ isMaximized: maximized }),
}));
