import { create } from 'zustand';
import * as likeApi from '@/tauri/like';
import { useAuthStore } from '@/features/auth/stores/authStore';
import { getLikedPlaylistId } from '../services/LikeService';

interface LikeStore {
  likedIds: Set<number>;
  isLoaded: boolean;
  /** 「我喜欢」歌单 id（心动模式 pid；登录后从 user_playlist 同步获取）。 */
  likedPlaylistId: number | null;
  /**
   * 幂等初始化：likedIds（Rust `like_init` 权威）+ 喜欢歌单 id。
   * 登录订阅与喜欢页取数共用，并发只发一轮请求（冷启动时序不确定也不影响）。
   */
  ensureInit: (uid: number) => Promise<void>;
  /** 带远程同步的点赞切换：乐观更新 → invoke like_toggle（Rust 权威）→ 失败回滚并 throw */
  toggleLikeRemote: (id: number, like: boolean) => Promise<void>;
  isLiked: (id: number) => boolean;
  clear: () => void;
}

/** 在途初始化任务：避免登录订阅与页面取数同时触发两轮 like_init。 */
let initTask: Promise<void> | null = null;

export const useLikeStore = create<LikeStore>((set, get) => {
  const runInit = async (uid: number) => {
    if (!get().isLoaded) {
      const ids = await likeApi.likeInit(uid);
      // 期间登出/换号则丢弃结果（Rust 权威集合已被 clear 或下一轮 init 覆盖）
      if (useAuthStore.getState().userId === uid) {
        set({ likedIds: new Set(ids), isLoaded: true });
      }
    }
    if (get().likedPlaylistId == null) {
      const id = await getLikedPlaylistId(uid);
      if (id != null) set({ likedPlaylistId: id });
    }
  };

  return {
    likedIds: new Set<number>(),
    isLoaded: false,
    likedPlaylistId: null,

    ensureInit: (uid) => {
      initTask ??= runInit(uid).finally(() => {
        initTask = null;
      });
      return initTask;
    },

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

    clear: () => {
      initTask = null;
      set({ likedIds: new Set(), isLoaded: false, likedPlaylistId: null });
    },
  };
});

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
  // 登录态唯一真相是 userId（见 authStore.selectIsLoggedIn），此处直接判 uid。
  if (state.userId != null && state.userId !== prev.userId) {
    // 失败不阻塞登录：喜欢页取数时会经 ensureInit 重试（initTask 已清空）。
    useLikeStore
      .getState()
      .ensureInit(state.userId)
      .catch(() => {});
  }
  if (state.userId === null && prev.userId !== null) {
    useLikeStore.getState().clear();
  }
});
