import { create } from 'zustand';
import { ncm } from '@/tauri/ncm';
import { useAuthStore } from './auth';

interface LikeStore {
  likedIds: Set<number>;
  isLoaded: boolean;
  init: (ids: number[]) => void;
  add: (id: number) => void;
  remove: (id: number) => void;
  toggle: (id: number) => void;
  /** 带远程同步的点赞切换：乐观更新 → ncm.like → 失败回滚并 throw */
  toggleLikeRemote: (id: number, like: boolean) => Promise<void>;
  isLiked: (id: number) => boolean;
  clear: () => void;
}

let likeEpoch = 0;

export const useLikeStore = create<LikeStore>((set, get) => ({
  likedIds: new Set<number>(),
  isLoaded: false,

  init: (ids) => {
    ++likeEpoch; // 使飞行中的 toggleLikeRemote 失效，防止回滚覆盖本次外部初始化
    set({ likedIds: new Set(ids), isLoaded: true });
  },

  add: (id) =>
    set((state) => {
      const next = new Set(state.likedIds);
      next.add(id);
      return { likedIds: next };
    }),

  remove: (id) =>
    set((state) => {
      const next = new Set(state.likedIds);
      next.delete(id);
      return { likedIds: next };
    }),

  toggle: (id) => {
    const { likedIds } = get();
    if (likedIds.has(id)) {
      get().remove(id);
    } else {
      get().add(id);
    }
  },

  toggleLikeRemote: async (id, like) => {
    const epoch = ++likeEpoch;
    const { likedIds } = get();
    const wasLiked = likedIds.has(id);

    // 乐观更新
    if (like) {
      set((state) => {
        const next = new Set(state.likedIds);
        next.add(id);
        return { likedIds: next };
      });
    } else {
      set((state) => {
        const next = new Set(state.likedIds);
        next.delete(id);
        return { likedIds: next };
      });
    }

    try {
      await ncm.like(id, like);
    } catch {
      // 仅在飞行期间没有外部操作（clear/init/其他 toggle 完成）时才回滚
      if (epoch === likeEpoch) {
        // 回滚到操作前的状态
        set((state) => {
          const next = new Set(state.likedIds);
          if (wasLiked) next.add(id);
          else next.delete(id);
          return { likedIds: next };
        });
      }
      throw new Error('操作失败');
    }
  },

  isLiked: (id) => get().likedIds.has(id),

  clear: () => {
    ++likeEpoch; // 使飞行中的 toggleLikeRemote 失效，防止回滚污染清空后的状态
    set({ likedIds: new Set(), isLoaded: false });
  },
}));

// ── self-init: auto-load likes when auth state changes ──

useAuthStore.subscribe((state, prev) => {
  if (state.isLoggedIn && state.userId && !useLikeStore.getState().isLoaded) {
    ncm
      .likeList(state.userId)
      .then((res) => useLikeStore.getState().init(res.ids))
      .catch(() => {});
  }
  if (!state.isLoggedIn && prev.isLoggedIn) {
    useLikeStore.getState().clear();
  }
});
