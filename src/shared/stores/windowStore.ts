import { create } from 'zustand';
import * as windowApi from '@/tauri/window';
import { useAppSettingsStore } from '@/shared/stores/appSettingsStore';

export type WindowState = 'normal' | 'maximized' | 'fullscreen';

interface WindowStore {
  state: WindowState;
  /** 建立窗口事件订阅（幂等；全站只在 bootstrap 装一次）。 */
  install: () => Promise<void>;
  /** 主动重读窗口态（事件驱动的同步之外的补一次，如 install 首帧）。 */
  sync: () => Promise<void>;
  toggleFullscreen: () => Promise<void>;
  toggleMaximize: () => Promise<void>;
  /** 退出全屏（tao 按进全屏前保存的 placement 还原到最大化/常态）。 */
  exitFullscreen: () => Promise<void>;
  minimize: () => Promise<void>;
  close: () => Promise<void>;
}

const resolveState = (max: boolean, full: boolean): WindowState => {
  if (full) return 'fullscreen';
  if (max) return 'maximized';
  return 'normal';
};

/** install 幂等标记：`useWindowState` 与 `bootstrap` 都会调，只装一次。 */
let installed = false;

/**
 * 窗口态的**唯一真相**。
 *
 * 为什么是 store 而不是某个组件的局部 state：全屏与否不只是「某个按钮要不要显示」，
 * 它是业务命令的输入（如「播放页全屏时不允许退出页面」的守卫）。命令层必须能**同步**读到它，
 * 不能各自 `isFullscreen()` 异步问一次。原先 `useWindowState` 在每个使用点各持一份
 * state + 各订阅一次 `onResized`（App / WindowControls / PlayerPage 三份），
 * 既重复又有互相不一致的窗口期。
 *
 * 分层：store → infra（`@/tauri/window`）。组件不直接读本 store，仍走 `useWindowState`（VM 门面）。
 *
 * 不需要再自己记账“进全屏前是否最大化”：tao 0.37.2 起（`#1353`）undecorated 窗口在最大化
 * 状态下进全屏不再被 `WM_NCCALCSIZE` 钳到工作区（旧版必须“先 unmaximize 再进全屏”，
 * 于是退出全屏还得手动 maximize 回最大化）；现在进全屏前 tao 自己存
 * `GetWindowPlacement`（`showCmd` 含 `SW_SHOWMAXIMIZED`），退出时 `SetWindowPlacement`
 * 直接还原到进全屏前的窗口态，所以全屏 ↔ 最大化 ↔ 常态只靠 `setFullscreen` 一步切换。
 *
 * 唯一保留的纪律：**全屏期间不要调 `unmaximize`/`maximize`**（`tao#1088` 的
 * `ShowWindow(SW_RESTORE)` 会打散全屏几何）。
 */
export const useWindowStore = create<WindowStore>()((set, get) => {
  const sync = async () => {
    const [max, full] = await Promise.all([
      windowApi.isMaximized(),
      windowApi.isFullscreen(),
    ]);
    set({ state: resolveState(max, full) });
  };

  return {
    state: 'normal',
    install: async () => {
      if (installed) return;
      installed = true;
      await sync();
      await windowApi.onResized(() => void sync());
    },
    sync,
    toggleFullscreen: async () => {
      // 用 tao 的真值而不是本地镜像判方向：切换是低频点击，多一次 IPC 不可感知，
      // 但能避开「刚切完、resize 事件还没回来又点一次」时切反。
      await windowApi.setFullscreen(!(await windowApi.isFullscreen()));
    },
    toggleMaximize: async () => {
      const { state } = get();
      if (state === 'fullscreen') {
        // 全屏中「还原」= 退出全屏，回到进全屏前的窗口态（由 tao 的 placement 还原）
        await windowApi.setFullscreen(false);
      } else if (state === 'maximized') {
        await windowApi.unmaximize();
      } else {
        await windowApi.maximize();
      }
    },
    // tao 在已经是窗口态时早退（`old_fullscreen == None`），所以调用方不用先判全屏
    exitFullscreen: () => windowApi.setFullscreen(false),
    minimize: () => windowApi.minimize(),
    close: async () => {
      const { closeBehavior } = useAppSettingsStore.getState().appearance;
      if (closeBehavior === 'hide') {
        await windowApi.hide();
      } else {
        await windowApi.close();
      }
    },
  };
});

/** 在 `bootstrap` 里调一次：窗口态在首个业务命令之前就位。 */
export function installWindowState(): Promise<void> {
  return useWindowStore.getState().install();
}
