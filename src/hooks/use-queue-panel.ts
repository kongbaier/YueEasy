import { useShallow } from "zustand/shallow";
import { useQueuePanelStore } from "@/stores/queue-panel";

export function useQueuePanel() {
  return useQueuePanelStore(
    useShallow((s) => ({
      open: s.open,
      animating: s.animating,
      openPanel: s.openPanel,
      closePanel: s.closePanel,
      finishClose: s.finishClose,
      toggle: s.toggle,
    })),
  );
}
