import { create } from "zustand";

interface QueuePanelStore {
  opened: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
}

export const useQueuePanelStore = create<QueuePanelStore>((set) => ({
  opened: false,
  open: () => set({ opened: true }),
  close: () => set({ opened: false }),
  toggle: () => set((state) => ({ opened: !state.opened })),
}));
