import { create } from 'zustand';

/**
 * Login dialog state — scoped to auth feature.
 * Any component that needs to trigger login imports this directly.
 */
export const useLoginDialog = create<{
  open: boolean;
  setOpen: (open: boolean) => void;
}>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
}));
