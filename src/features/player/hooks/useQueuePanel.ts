import { useShallow } from 'zustand/shallow';
import { useQueueDrawerStore } from '@/features/player/stores/queueDrawerStore';

/**
 * 播放队列侧边面板开关的 VM 门面：暴露 isOpen / open / close / toggle。
 * 组件只 import 本 hook，不直接触碰 store。
 */
export function useQueueDrawer() {
  return useQueueDrawerStore(
    useShallow((s) => ({
      isOpen: s.isOpen,
      open: s.open,
      close: s.close,
      toggle: s.toggle,
    })),
  );
}
