import { useCallback } from 'react';
import { useAuthStore } from '@/stores/auth';
import { useLikeStore } from '@/stores/like';
import { useLoginDialog } from '@/modules/auth/loginDialogStore';
import { toast } from '@/shared/lib/toast';

export function useLikeAction() {
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const setLoginDialogOpen = useLoginDialog((s) => s.setOpen);
  const toggleLikeRemote = useLikeStore((s) => s.toggleLikeRemote);
  // 订阅 likedIds（Set 引用变化触发重渲染），保证 isLiked(id) 结果随点赞状态更新
  const likedIds = useLikeStore((s) => s.likedIds);
  const isLiked = (id: number) => likedIds.has(id);

  const handleLike = useCallback(
    async (trackId: number, trackName: string) => {
      if (!isLoggedIn) {
        toast.error('请先登录');
        setLoginDialogOpen(true);
        return;
      }
      const currentIsLiked = useLikeStore.getState().isLiked(trackId);
      const next = !currentIsLiked;
      try {
        await toggleLikeRemote(trackId, next);
        toast.success(next ? `已收藏 ${trackName}` : `已取消收藏 ${trackName}`);
      } catch {
        toast.error('操作失败，请重试');
      }
    },
    [isLoggedIn, setLoginDialogOpen, toggleLikeRemote],
  );

  return { handleLike, isLiked };
}
