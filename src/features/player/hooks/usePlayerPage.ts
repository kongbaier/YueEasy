import { useShallow } from 'zustand/shallow';
import { usePlayerPageStore } from '@/features/player/stores/playerPageStore';

/**
 * 全屏播放页开关的 VM 门面：暴露 isOpen / open / close / runAfterExit。
 * 组件与跨功能 viewmodel 只 import 本 hook，不直接触碰 store。
 */
export function usePlayerPage() {
  return usePlayerPageStore(
    useShallow((s) => ({
      isOpen: s.isOpen,
      open: s.open,
      close: s.close,
      runAfterExit: s.runAfterExit,
    })),
  );
}
