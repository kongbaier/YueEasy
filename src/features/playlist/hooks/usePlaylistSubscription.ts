import { useCallback, useState } from 'react';
import { useAuthStore } from '@/features/auth/stores/authStore';
import { useLoginModal } from '@/features/auth/stores/loginModalStore';
import { queryClient } from '@/shared/lib/queryClient';
import { toast } from '@/shared/lib/toast';
import type { Playlist } from '@/shared/types/uiModels';
import { setPlaylistSubscribed } from '../playlist-service';

/** IPC 错误（Rust `NcmApiError` 序列化为 `{ kind, message }`）→ 可展示文案。 */
function errorText(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === 'object' && e !== null && 'message' in e) {
    const { message } = e as { message?: unknown };
    if (typeof message === 'string' && message) return message;
  }
  return '操作失败，请重试';
}

/** 乐观改写详情缓存：收藏状态与收藏数同步增减。 */
function patchSubscribedCache(id: number, subscribe: boolean) {
  queryClient.setQueryData<Playlist>(['playlist', id], (old) => {
    if (!old) return old;
    return {
      ...old,
      subscribed: subscribe,
      subscribedCount: Math.max(
        0,
        (old.subscribedCount ?? 0) + (subscribe ? 1 : -1),
      ),
    };
  });
}

/**
 * 歌单收藏（订阅）切换：鉴权编排 + 乐观更新 → 远程命令 → 失败回滚 + toast。
 * 状态唯一来源是详情 query 缓存；成功后失效「我的歌单」让侧栏同步。
 * 自己的歌单不可收藏（`isOwn`，由调用方决定是否渲染按钮）。
 */
export function usePlaylistSubscription(playlist: Playlist) {
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const userId = useAuthStore((s) => s.userId);
  const setLoginModalOpen = useLoginModal((s) => s.setOpen);
  const [isPending, setIsPending] = useState(false);

  const isOwn = playlist.creator?.id != null && playlist.creator.id === userId;
  const subscribed = playlist.subscribed ?? false;

  const toggle = useCallback(async () => {
    if (isPending) return;
    if (!isLoggedIn) {
      toast.error('请先登录');
      setLoginModalOpen(true);
      return;
    }

    const next = !subscribed;
    patchSubscribedCache(playlist.id, next);
    setIsPending(true);
    try {
      await setPlaylistSubscribed(playlist.id, next);
      if (userId) {
        await queryClient.invalidateQueries({
          queryKey: ['userPlaylists', userId],
        });
      }
      toast.success(next ? '已收藏歌单' : '已取消收藏歌单');
    } catch (e) {
      patchSubscribedCache(playlist.id, !next);
      toast.error(errorText(e));
    } finally {
      setIsPending(false);
    }
  }, [
    isLoggedIn,
    isPending,
    playlist.id,
    setLoginModalOpen,
    subscribed,
    userId,
  ]);

  return { isOwn, isPending, subscribed, toggle };
}
