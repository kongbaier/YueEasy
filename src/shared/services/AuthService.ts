import { ncm, setNcmCookie, clearNcmCookie } from '@/tauri/ncm';
import type { User } from '@/shared/types/entities';
import { useAuthStore } from '@/stores/auth';

export type AuthProfile = User;

/** 登录成功后统一处理：落 cookie + 更新 auth store + 返回 profile */
function applyAuth(cookie: string, profile?: Partial<AuthProfile> | null) {
  // 登录/扫码过程中 Rust 侧（run）已把 Set-Cookie 合并并持久化；
  // 响应体 cookie 为空时不能覆盖，否则会清掉已落盘的会话。
  if (cookie) setNcmCookie(cookie);
  useAuthStore.getState().setAuth({
    isLoggedIn: true,
    cookie,
    userId: profile?.id ?? null,
    nickname: profile?.nickname ?? '',
    avatarUrl: profile?.avatarUrl ?? '',
  });
  return profile;
}

export const authService = {
  loginWithPassword: async (
    phone: string,
    password: string,
  ): Promise<AuthProfile | null> => {
    const res = await ncm.loginCellphone({ phone, password });
    const profile = res.profile ?? null;
    applyAuth(res.cookie, profile);
    return profile;
  },

  sendSmsCode: async (phone: string): Promise<void> => {
    await ncm.captchaSent(phone);
  },

  loginWithSms: async (
    phone: string,
    code: string,
  ): Promise<AuthProfile | null> => {
    const res = await ncm.loginCellphone({ phone, captcha: code });
    const profile = res.profile ?? null;
    applyAuth(res.cookie, profile);
    return profile;
  },

  getQrKey: () => ncm.qrKey(),
  createQr: (key: string) => ncm.qrCreate(key),
  checkQr: (key: string) => ncm.qrCheck(key),

  /** 扫码登录成功后的 profile 补全 */
  fetchProfile: async (
    cookie: string,
  ): Promise<Partial<AuthProfile> | null> => {
    const statusRes = await ncm.loginStatus();
    const profile = statusRes.profile ?? null;
    if (profile?.id) {
      applyAuth(cookie, profile);
      return profile;
    }
    return null;
  },

  logout: () => {
    clearNcmCookie();
    useAuthStore.getState().logout();
  },
};

