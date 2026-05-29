import { create } from "zustand";

interface QueuePanelStore {
  open: boolean;
  animating: boolean;
  openPanel: () => void;
  closePanel: () => void;
  finishClose: () => void;
  toggle: () => void;
}

export const useQueuePanelStore = create<QueuePanelStore>((set) => ({
  open: false,
  animating: false,
  openPanel: () => {
    set({ open: true });
    requestAnimationFrame(() => set({ animating: true }));
  },
  closePanel: () => set({ animating: false }),
  finishClose: () => set({ open: false }),
  toggle: () => {
    set((state) => {
      if (state.open) {
        return { open: false, animating: false };
      }
      requestAnimationFrame(() => set({ animating: true }));
      return { open: true };
    });
  },
}));
