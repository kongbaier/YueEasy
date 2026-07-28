import { create } from "zustand";
import { clearNcmCookie, getNcmCookie, ncm } from "@/shared/services/ncm";

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

/**
 * Restore login session from persisted cookie.
 * Called once at app startup (bootstrap).
 */
export async function initAuth() {
  try {
    const cookie = await getNcmCookie();
    if (!cookie) return;

    const res = await ncm.loginStatus();
    const profile =
      res.data?.profile ??
      ((res as unknown as Record<string, unknown>).profile as
        | { userId: number; nickname: string; avatarUrl: string }
        | undefined);
    const statusCode =
      res.data?.code ?? (res as unknown as Record<string, unknown>).code;

    if (statusCode === 200 && profile?.userId) {
      useAuthStore.getState().setAuth({
        isLoggedIn: true,
        cookie,
        userId: profile.userId,
        nickname: profile.nickname ?? "",
        avatarUrl: profile.avatarUrl ?? "",
      });
    } else {
      await clearNcmCookie();
    }
  } catch {
    // network error — cookie may still be valid, don't clear
  }
}
