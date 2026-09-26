import { useAuthStore } from '../stores/authStore';
import { useLoginModal } from '../stores/loginModalStore';
import * as authService from '../services/AuthService';

export const useAuthViewModel = () => {
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const userId = useAuthStore((s) => s.userId);
  const nickname = useAuthStore((s) => s.nickname);
  const avatarUrl = useAuthStore((s) => s.avatarUrl);
  const loginModalOpen = useLoginModal((s) => s.open);
  const setLoginModalOpen = useLoginModal((s) => s.setOpen);

  return {
    isLoggedIn,
    userId,
    nickname,
    avatarUrl,
    loginModalOpen,
    setLoginModalOpen,
    openLogin: () => setLoginModalOpen(true),
    ...authService,
  };
};
