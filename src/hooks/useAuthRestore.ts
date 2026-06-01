import { useEffect, useRef } from "react";
import { clearNcmCookie, getNcmCookie, ncm } from "@/services/ncm";
import { useAuthStore } from "@/stores";

export function useAuthRestore() {
  const setAuth = useAuthStore((s) => s.setAuth);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    (async () => {
      try {
        const cookie = await getNcmCookie();
        console.log(
          "[useAuthRestore] cookie from Rust:",
          cookie ? `${cookie.substring(0, 50)}...` : "(empty)",
        );
        if (!cookie) return;

        const res = await ncm.loginStatus();
        console.log(
          "[useAuthRestore] loginStatus response:",
          JSON.stringify(res),
        );

        // NetEase API may return profile in different shapes:
        // { data: { code: 200, profile: {...} } }
        // { code: 200, profile: {...} }
        // { data: { code: 200, account: {...}, profile: {...} } }
        const profile =
          res.data?.profile ??
          ((res as unknown as Record<string, unknown>).profile as
            | { userId: number; nickname: string; avatarUrl: string }
            | undefined);

        const statusCode =
          res.data?.code ?? (res as unknown as Record<string, unknown>).code;

        console.log(
          "[useAuthRestore] resolved statusCode:",
          statusCode,
          "profile:",
          profile,
        );

        if (statusCode === 200 && profile?.userId) {
          console.log("[useAuthRestore] restoring auth state");
          setAuth({
            isLoggedIn: true,
            cookie,
            userId: profile.userId,
            nickname: profile.nickname ?? "",
            avatarUrl: profile.avatarUrl ?? "",
          });
        } else {
          console.log("[useAuthRestore] not logged in, clearing");
          await clearNcmCookie();
        }
      } catch (err) {
        console.error("[useAuthRestore] error:", err);
        await clearNcmCookie().catch(() => {});
      }
    })();
  }, [setAuth]);
}
