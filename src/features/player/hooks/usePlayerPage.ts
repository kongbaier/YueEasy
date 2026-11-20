import { useShallow } from 'zustand/shallow';
import { usePlayerPageStore } from '@/features/player/stores/playerPageStore';

/**
 * 全屏播放页开关的 VM 门面：暴露 isOpen / open / close / runAfterExit。
 * 组件与跨功能 viewmodel 只 import 本 hook，不直接触碰 store。
 *
 * `close` 自带「收全屏」（见 `playerPageStore.close`）：它是退出播放页的唯一动作，
 * 调用方不需要关心窗口当前是否全屏。
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
