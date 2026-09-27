import { create } from 'zustand';

// queuePanelStore —— 播放队列侧边面板的开关状态（纯 UI 状态，全局单例）。
//
// 触发方与消费方分处两棵子树：PlayerBar 打开、QueuePanel（fixed 覆盖全屏）自持开关与关闭。
// 二者都由 app 壳装配，若把状态放在 app/layout 的 useState，壳就持有了播放域的 UI 状态、
// 并把两个组件用回调绑死。故与 playerPageStore 同构，改为模块级 store，
// 组件各自经 useQueuePanel 门面读写，不再 prop 透传。

interface QueueDrawerState {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
}

export const useQueueDrawerStore = create<QueueDrawerState>()((set) => ({
  isOpen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
  toggle: () => set((s) => ({ isOpen: !s.isOpen })),
}));
