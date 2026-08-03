import { ncm, setNcmCookie, clearNcmCookie } from '@/tauri/ncm';
import { useAuthStore } from '@/stores/auth';

export interface AuthProfile {
  userId: number;
  nickname: string;
  avatarUrl: string;
}

/** 登录成功后统一处理：落 cookie + 更新 auth store + 返回 profile */
function applyAuth(cookie: string, profile?: Partial<AuthProfile> | null) {
  setNcmCookie(cookie);
  useAuthStore.getState().setAuth({
    isLoggedIn: true,
    cookie,
    userId: profile?.userId ?? null,
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
    if (res.code !== 200) throw new Error(`登录失败 (${res.code})`);
    const profile = res.profile ?? null;
    applyAuth(res.cookie, profile);
    return profile;
  },

  sendSmsCode: (phone: string) => ncm.captchaSent(phone),

  loginWithSms: async (
    phone: string,
    code: string,
  ): Promise<AuthProfile | null> => {
    const res = await ncm.loginCellphone({ phone, captcha: code });
    if (res.code !== 200) throw new Error(`登录失败 (${res.code})`);
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
    const profile =
      statusRes.data?.profile ??
      ((statusRes as unknown as Record<string, unknown>).profile as
        | Partial<AuthProfile>
        | undefined) ??
      null;
    if (profile?.userId) {
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
