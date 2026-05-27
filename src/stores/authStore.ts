import { create } from "zustand";
import type { AuthState } from "@/types/user";

interface AuthStore extends AuthState {
  setAuth: (state: Partial<AuthState>) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  isLoggedIn: false,
  cookie: "",
  userId: null,
  nickname: "",
  avatarUrl: "",

  setAuth: (state) => set(state),
  logout: () =>
    set({
      isLoggedIn: false,
      cookie: "",
      userId: null,
      nickname: "",
      avatarUrl: "",
    }),
}));
