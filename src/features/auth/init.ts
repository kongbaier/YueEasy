import { clearNcmCookie, getNcmCookie, ncm } from "@/shared/services/ncm";
import { useAuthStore, useLikeStore } from "@/stores";

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

/** Call after initAuth resolves. */
export function initLikes() {
  const { isLoggedIn, userId } = useAuthStore.getState();
  if (isLoggedIn && userId) {
    ncm
      .likeList(userId)
      .then((res) => useLikeStore.getState().init(res.ids))
      .catch(() => {});
  }
}
