import { useAuthStore } from '../stores/authStore';
import { useLoginDialog } from '../stores/loginDialogStore';
import { authService } from '../services/AuthService';

export const useAuthViewModel = () => {
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const userId = useAuthStore((s) => s.userId);
  const nickname = useAuthStore((s) => s.nickname);
  const avatarUrl = useAuthStore((s) => s.avatarUrl);
  const loginDialogOpen = useLoginDialog((s) => s.open);
  const setLoginDialogOpen = useLoginDialog((s) => s.setOpen);

  return {
    isLoggedIn,
    userId,
    nickname,
    avatarUrl,
    loginDialogOpen,
    setLoginDialogOpen,
    openLogin: () => setLoginDialogOpen(true),
    ...authService,
  };
};
