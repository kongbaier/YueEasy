import { create } from "zustand";

interface LikeStore {
  likedIds: Set<number>;
  isLoaded: boolean;
  init: (ids: number[]) => void;
  add: (id: number) => void;
  remove: (id: number) => void;
  toggle: (id: number) => void;
  isLiked: (id: number) => boolean;
  clear: () => void;
}

export const useLikeStore = create<LikeStore>((set, get) => ({
  likedIds: new Set<number>(),
  isLoaded: false,

  init: (ids) => set({ likedIds: new Set(ids), isLoaded: true }),

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

  isLiked: (id) => get().likedIds.has(id),

  clear: () => set({ likedIds: new Set(), isLoaded: false }),
}));
