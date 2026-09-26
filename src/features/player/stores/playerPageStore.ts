import { create } from 'zustand';

// playerPageStore —— 全屏播放页的开关状态（纯 UI 状态，全局单例）。
//
// 由 PlayerBar / FmCard 打开、PlayerPage / PlayerPageQueue 关闭。原先用 Context +
// Provider 承载，但全屏播放页全局仅一份、无需实例隔离，Provider 反而让 app 壳
// （router.tsx）与 home 的 viewmodel 隐式依赖播放域的装配位置，故改为模块级 store。

interface PlayerPageState {
  isOpen: boolean;
  open: () => void;
  /**
   * 关闭播放页。传入 afterClose 时，会在退出动画结束后执行它
   * （用于"先关页面、动画结束再改队列"的操作，如清空播放列表）。
   */
  close: (afterClose?: () => void) => void;
  /** 由 PlayerPage 在 AnimatePresence 退出动画完成时调用，执行并清空挂起的 afterClose。 */
  runAfterExit: () => void;
}

// 非响应式槽位：挂起「退出动画结束后执行」的回调，不进 React 渲染。
let pendingAfterClose: (() => void) | null = null;

export const usePlayerPageStore = create<PlayerPageState>()((set) => ({
  isOpen: false,
  open: () => set({ isOpen: true }),
  close: (afterClose) => {
    pendingAfterClose = afterClose ?? null;
    set({ isOpen: false });
  },
  runAfterExit: () => {
    const fn = pendingAfterClose;
    pendingAfterClose = null;
    fn?.();
  },
}));
