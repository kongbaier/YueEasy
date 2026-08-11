import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getUserPlaylists } from './SidebarService';
import { useAuthStore } from '@/stores/auth';
import { toast } from '@/shared/lib/toast';

export function useSidebarPlaylists() {
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const userId = useAuthStore((s) => s.userId);

  const { data, isError } = useQuery({
    queryKey: ['userPlaylists', userId],
    queryFn: () => getUserPlaylists(userId!),
    enabled: isLoggedIn && !!userId,
    retry: 1,
  });

  useEffect(() => {
    if (isError) toast.error('加载歌单失败，请检查网络');
  }, [isError]);

  return { userPlaylists: data ?? [] };
}