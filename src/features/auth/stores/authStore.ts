import { create } from 'zustand';
import { clearNcmCookie, getNcmCookie, ncm } from '@/tauri/ncm';

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
  cookie: '',
  userId: null,
  nickname: '',
  avatarUrl: '',

  setAuth: (state) => set(state),
  logout: () => {
    clearNcmCookie();
    set({
      isLoggedIn: false,
      cookie: '',
      userId: null,
      nickname: '',
      avatarUrl: '',
    });
  },
}));

/**
 * Restore login session from persisted cookie.
 * Called once at app startup (bootstrap).
 * 登录状态已由 Rust 适配层归一为 `LoginStatus { profile? }`，前端不再判断 code。
 */
export async function initAuth() {
  try {
    const cookie = await getNcmCookie();
    if (!cookie) return;

    const res = await ncm.loginStatus();
    const profile = res.profile;

    if (profile?.id) {
      useAuthStore.getState().setAuth({
        isLoggedIn: true,
        cookie,
        userId: profile.id,
        nickname: profile.nickname ?? '',
        avatarUrl: profile.avatarUrl ?? '',
      });
    } else {
      await clearNcmCookie();
    }
  } catch {
    // network error — cookie may still be valid, don't clear
  }
}
