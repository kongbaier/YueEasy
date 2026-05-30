import { create } from "zustand";
import type { AuthState } from "@/types/user";
import { clearNcmCookie } from "@/services/ncm";

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
  logout: () => {
    clearNcmCookie();
    set({
      isLoggedIn: false,
      cookie: "",
      userId: null,
      nickname: "",
      avatarUrl: "",
    });
  },
}));
