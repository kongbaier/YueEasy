import { create } from "zustand";

type Theme = "light" | "dark";

interface UiStore {
  theme: Theme;
  loginDialogOpen: boolean;
  setTheme: (theme: Theme) => void;
  setLoginDialogOpen: (open: boolean) => void;
}

export const useUiStore = create<UiStore>((set) => ({
  theme: "dark" as Theme,
  loginDialogOpen: false,

  setTheme: (theme) => set({ theme }),
  setLoginDialogOpen: (open) => set({ loginDialogOpen: open }),
}));
