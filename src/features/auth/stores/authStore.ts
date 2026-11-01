import { create } from 'zustand';
import { clearNcmCookie, getNcmCookie, ncm } from '@/tauri/ncm';

interface AuthState {
  cookie: string;
  userId: number | null;
  nickname: string;
  avatarUrl: string;
}

interface AuthStore extends AuthState {
  setAuth: (state: Partial<AuthState>) => void;
  logout: () => void;
}

/**
 * 登录态的唯一真相：`userId` 非空即已登录。
 * `isLoggedIn` 不再作为独立字段存储（曾与 userId 重复写入，可能不同步），
 * 需要布尔值时统一用本选择器派生：`useAuthStore(selectIsLoggedIn)`。
 */
export const selectIsLoggedIn = (state: AuthState) => state.userId !== null;

export const useAuthStore = create<AuthStore>((set) => ({
  cookie: '',
  userId: null,
  nickname: '',
  avatarUrl: '',

  setAuth: (state) => set(state),
  logout: () => {
    clearNcmCookie();
    set({
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
