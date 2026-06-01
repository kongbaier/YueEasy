import { create } from "zustand";
import { clearNcmCookie } from "@/services/ncm";

interface AuthState {
  isLoggedIn: boolean;
  cookie: string;
  userId: number | null;
  nickname: string;
  avatarUrl: string;
}

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
