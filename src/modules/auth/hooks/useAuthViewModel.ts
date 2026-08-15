import { useMemo } from 'react';
import { useAuthStore } from '@/modules/auth/stores/authStore';
import { useLoginDialog } from '@/modules/auth/stores/loginDialogStore';
import { authService } from '@/modules/auth/services/AuthService';

export function useAuthViewModel() {
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const userId = useAuthStore((s) => s.userId);
  const nickname = useAuthStore((s) => s.nickname);
  const avatarUrl = useAuthStore((s) => s.avatarUrl);
  const loginDialogOpen = useLoginDialog((s) => s.open);
  const setLoginDialogOpen = useLoginDialog((s) => s.setOpen);

  return useMemo(
    () => ({
      isLoggedIn,
      userId,
      nickname,
      avatarUrl,
      loginDialogOpen,
      setLoginDialogOpen,
      openLogin: () => setLoginDialogOpen(true),
      ...authService,
    }),
    [
      isLoggedIn,
      userId,
      nickname,
      avatarUrl,
      loginDialogOpen,
      setLoginDialogOpen,
    ],
  );
}
