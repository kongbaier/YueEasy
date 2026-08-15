import { create } from 'zustand';
import * as likeApi from '@/tauri/like';
import { useAuthStore } from '@/modules/auth/stores/authStore';
import { getLikedPlaylistId } from '../services/LikeService';

interface LikeStore {
  likedIds: Set<number>;
  isLoaded: boolean;
  /** 「我喜欢」歌单 id（心动模式 pid；登录后从 user_playlist 同步获取）。 */
  likedPlaylistId: number | null;
  init: (ids: number[]) => void;
  setLikedPlaylistId: (id: number | null) => void;
  /** 带远程同步的点赞切换：乐观更新 → invoke like_toggle（Rust 权威）→ 失败回滚并 throw */
  toggleLikeRemote: (id: number, like: boolean) => Promise<void>;
  isLiked: (id: number) => boolean;
  clear: () => void;
}

export const useLikeStore = create<LikeStore>((set, get) => ({
  likedIds: new Set<number>(),
  isLoaded: false,
  likedPlaylistId: null,

  init: (ids) => set({ likedIds: new Set(ids), isLoaded: true }),

  setLikedPlaylistId: (id) => set({ likedPlaylistId: id }),

  toggleLikeRemote: async (id, like) => {
    // 乐观更新（UI 即时反馈）
    set((state) => {
      const next = new Set(state.likedIds);
      if (like) next.add(id);
      else next.delete(id);
      return { likedIds: next };
    });

    try {
      await likeApi.likeToggle(id, like);
    } catch {
      // 失败回滚到操作前状态
      set((state) => {
        const next = new Set(state.likedIds);
        if (like) next.delete(id);
        else next.add(id);
        return { likedIds: next };
      });
      throw new Error('操作失败');
    }
  },

  isLiked: (id) => get().likedIds.has(id),

  clear: () =>
    set({ likedIds: new Set(), isLoaded: false, likedPlaylistId: null }),
}));

// ── Rust 权威事件校正镜像（幂等；事件封装在 @/tauri/like） ──

void likeApi.onLikedIdsChanged((ids) => {
  useLikeStore.setState({ likedIds: new Set(ids), isLoaded: true });
});

void likeApi.onLikedToggled((trackId, liked) => {
  useLikeStore.setState((state) => {
    const next = new Set(state.likedIds);
    if (liked) next.add(trackId);
    else next.delete(trackId);
    return { likedIds: next };
  });
});

// ── self-init: 登录后由 Rust 端拉取喜欢列表（like_init）+ 喜欢歌单 id，前端只读结果 ──

useAuthStore.subscribe((state, prev) => {
  if (state.isLoggedIn && state.userId && !useLikeStore.getState().isLoaded) {
    likeApi
      .likeInit(state.userId)
      .then((ids) => useLikeStore.getState().init(ids))
      .catch(() => {});
    // 同步获取「我喜欢」歌单 id（心动模式 pid）
    getLikedPlaylistId(state.userId)
      .then((id) => useLikeStore.getState().setLikedPlaylistId(id))
      .catch(() => {});
  }
  if (!state.isLoggedIn && prev.isLoggedIn) {
    useLikeStore.getState().clear();
  }
});
