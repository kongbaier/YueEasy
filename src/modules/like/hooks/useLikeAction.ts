import { useCallback } from 'react';
import { useAuthStore } from '@/modules/auth/stores/authStore';
import { useLikeStore } from '@/modules/like/stores/like';
import { useLoginDialog } from '@/modules/auth/stores/loginDialogStore';
import { queryClient } from '@/shared/lib/queryClient';
import { toast } from '@/shared/lib/toast';
import type { Song } from '@/shared/types/entities';

/** 喜欢时乐观插入喜欢页缓存（仅当缓存已存在时才插入，避免覆盖未取数的空缓存）。 */
function insertLikedSongCache(track: Song) {
  const userId = useAuthStore.getState().userId;
  if (!userId) return;
  queryClient.setQueryData<Song[]>(['likedSongs', userId], (old) => {
    if (!old) return old;
    return old.some((s) => s.id === track.id) ? old : [track, ...old];
  });
}

/** 从喜欢页缓存移除一首（乐观插入失败时的回滚）。 */
function removeLikedSongCache(trackId: number) {
  const userId = useAuthStore.getState().userId;
  if (!userId) return;
  queryClient.setQueryData<Song[]>(['likedSongs', userId], (old) =>
    (old ?? []).filter((s) => s.id !== trackId),
  );
}

export function useLikeAction() {
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const setLoginDialogOpen = useLoginDialog((s) => s.setOpen);
  const toggleLikeRemote = useLikeStore((s) => s.toggleLikeRemote);
  // 订阅 likedIds（Set 引用变化触发重渲染），保证 isLiked(id) 结果随点赞状态更新
  const likedIds = useLikeStore((s) => s.likedIds);
  const isLiked = (id: number) => likedIds.has(id);

  const handleLike = useCallback(
    async (track: Song) => {
      if (!isLoggedIn) {
        toast.error('请先登录');
        setLoginDialogOpen(true);
        return;
      }
      const currentIsLiked = useLikeStore.getState().isLiked(track.id);
      const next = !currentIsLiked;
      // 仅「喜欢」时乐观插入缓存；「取消喜欢」不直接移除列表，进入喜欢页时由 useEffectOnActive 合并。
      if (next) {
        insertLikedSongCache(track);
      }
      try {
        await toggleLikeRemote(track.id, next);
        toast.success(
          next ? `已收藏 ${track.name}` : `已取消收藏 ${track.name}`,
        );
      } catch {
        if (next) {
          removeLikedSongCache(track.id);
        }
        toast.error('操作失败，请重试');
      }
    },
    [isLoggedIn, setLoginDialogOpen, toggleLikeRemote],
  );

  return { handleLike, isLiked };
}
