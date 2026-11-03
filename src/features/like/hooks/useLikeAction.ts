import { useCallback } from 'react';
import {
  selectIsLoggedIn,
  useAuthStore,
} from '@/features/auth/stores/authStore';
import { useLikeStore } from '@/features/like/stores/like';
import { useLoginModal } from '@/features/auth/stores/loginModalStore';
import { toast } from '@/shared/lib/toast';
import type { Song } from '@/shared/types/uiModels';
import { patchLikedSongs } from '../services/LikedSongsCache';

/**
 * 喜欢时乐观插入喜欢页缓存（仅当缓存已存在时才插入，避免覆盖未取数的空缓存）。
 * 带 Song 元数据插入是必须的：`likedIds` 只有 id，页面靠这份缓存拿到新喜欢的歌。
 */
function insertLikedSong(track: Song) {
  patchLikedSongs(useAuthStore.getState().userId, (songs) =>
    songs.some((s) => s.id === track.id) ? songs : [track, ...songs],
  );
}

/** 乐观插入失败时的回滚（喜欢页本身从不因取消喜欢而收缩列表）。 */
function removeLikedSong(trackId: number) {
  patchLikedSongs(useAuthStore.getState().userId, (songs) => {
    const kept = songs.filter((s) => s.id !== trackId);
    return kept.length === songs.length ? songs : kept;
  });
}

export function useLikeAction() {
  const isLoggedIn = useAuthStore(selectIsLoggedIn);
  const setLoginModalOpen = useLoginModal((s) => s.setOpen);
  const toggleLikeRemote = useLikeStore((s) => s.toggleLikeRemote);
  // 订阅 likedIds（Set 引用变化触发重渲染），保证 isLiked(id) 结果随点赞状态更新
  const likedIds = useLikeStore((s) => s.likedIds);
  const isLiked = (id: number) => likedIds.has(id);

  const like = useCallback(
    async (track: Song) => {
      if (!isLoggedIn) {
        toast.error('请先登录');
        setLoginModalOpen(true);
        return;
      }
      const currentIsLiked = useLikeStore.getState().isLiked(track.id);
      const next = !currentIsLiked;
      // 仅「喜欢」时乐观插入缓存（需要 Song 元数据）；「取消喜欢」不做页内动态处理：
      // 行保留、红心变空，下次进入喜欢页时重取（服务端快照）自然收敛。
      if (next) {
        insertLikedSong(track);
      }
      try {
        await toggleLikeRemote(track.id, next);
        toast.success(
          next ? `已喜欢 ${track.name}` : `已取消喜欢 ${track.name}`,
        );
      } catch {
        if (next) {
          removeLikedSong(track.id);
        }
        toast.error('操作失败，请重试');
      }
    },
    [isLoggedIn, setLoginModalOpen, toggleLikeRemote],
  );

  return { like, isLiked };
}
