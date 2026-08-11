import { useMemo } from 'react';
import { useAuthStore } from '@/stores/auth';
import { useLoginDialog } from '@/modules/auth/loginDialogStore';
import { authService } from '@/shared/services/AuthService';

export function useAuthViewModel() {
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const userId = useAuthStore((s) => s.userId);
  const nickname = useAuthStore((s) => s.nickname);
  const avatarUrl = useAuthStore((s) => s.avatarUrl);
  const openLogin = useLoginDialog((s) => s.setOpen);

  return useMemo(
    () => ({
      isLoggedIn,
      userId,
      nickname,
      avatarUrl,
      openLogin: () => openLogin(true),
      ...authService,
    }),
    [isLoggedIn, userId, nickname, avatarUrl, openLogin],
  );
}