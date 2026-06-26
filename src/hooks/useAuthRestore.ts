import { useEffect, useRef } from "react";
import { clearNcmCookie, getNcmCookie, ncm } from "@/services/ncm";
import { useAuthStore } from "@/stores";

export const useAuthRestore = () => {
  const setAuth = useAuthStore((s) => s.setAuth);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    (async () => {
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
          setAuth({
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
        // 网络不可用或其他暂时性错误，不清除 cookie
        // cookie 仍然有效，下次启动有网络时可以恢复登录
      }
    })();
  }, [setAuth]);
};
