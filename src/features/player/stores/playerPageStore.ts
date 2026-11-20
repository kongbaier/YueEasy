import { create } from 'zustand';
import { useWindowStore } from '@/shared/stores/windowStore';

// playerPageStore —— 全屏播放页的开关状态（纯 UI 状态，全局单例）。
//
// 由 PlayerBar / FmCard 打开、PlayerPage / PlayerPageQueue 关闭。原先用 Context +
// Provider 承载，但全屏播放页全局仅一份、无需实例隔离，Provider 反而让 app 壳
// （router.tsx）与 home 的 viewmodel 隐式依赖播放域的装配位置，故改为模块级 store。

interface PlayerPageState {
  isOpen: boolean;
  open: () => void;
  /**
   * 退出播放页 —— **唯一出口**。
   *
   * 全屏是播放页的形态，不是窗口的独立状态：因此「退出页面」这个动作自带
   * 「收全屏」，一步到位（全屏下按返回 = 退出全屏 + 返回，不会留下
   * 「全屏的应用 + 没有全屏 UI」这种不可自洽的组合）。
   *
   * 收全屏写在这里而不是写在各调用的 `onClick`：出口只有一个，快捷键 / 系统事件 /
   * 其它功能的跳转等未来入口自动获得同一行为，UI 也不必再用「隐藏按钮」表达策略。
   * 非全屏时 `setFullscreen(false)` 会被 tao 早退（`old_fullscreen == None`），零副作用。
   *
   * 传入 afterClose 时，会在退出动画结束后执行它（用于"先关页面、动画结束再改队列"的操作）。
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
    void useWindowStore.getState().exitFullscreen();
    pendingAfterClose = afterClose ?? null;
    set({ isOpen: false });
  },
  runAfterExit: () => {
    const fn = pendingAfterClose;
    pendingAfterClose = null;
    fn?.();
  },
}));
