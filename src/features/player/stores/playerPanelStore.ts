import { create } from 'zustand';

/**
 * 播放页**面板**的生命周期（纯 UI 相位，不是「页面」）。
 *
 * 为什么是面板、不是路由页：想要的效果是「一块板子透明度降、另一块升」——那要求
 * 两块板子在淡变期间**同时在文档里**。而路由换页会把上一页的 DOM 卸掉（KeepAlive 摘挂），
 * 只剩一块板子就没什么可交叉淡变的了。所以：
 *
 * - 应用（外壳 + 当前页）是一块板子，始终挂载，进入时整块 `opacity 1 → 0`；
 * - 播放页是另一块板子，挂在**布局层**（`AppLayout`），不参与 outlet 换页，
 *   进入时 `opacity 0 → 1`，退出时反过来。
 *
 * `/player` 路由仍然存在，但只做 URL / 返回键的镜像：进场动画跑完才导航进去
 * （那时应用那块板子已经不可见，卸掉它没人看得见）；退出时先导航回来
 * （应用板子先回到文档里、当底下的那块），再淡出面板。
 */
interface PlayerPanelState {
  /** 面板是否在文档里（进场动画开始 → 退场动画结束） */
  visible: boolean;
  /** 退场相位：面板还在，正在淡出 */
  closing: boolean;
  show: () => void;
  startClosing: () => void;
  hide: () => void;
}

export const usePlayerPanelStore = create<PlayerPanelState>()((set) => ({
  visible: false,
  closing: false,
  show: () => set({ visible: true, closing: false }),
  startClosing: () => set((s) => (s.visible ? { closing: true } : s)),
  hide: () => set({ visible: false, closing: false }),
}));
