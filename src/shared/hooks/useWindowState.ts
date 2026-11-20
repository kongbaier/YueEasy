import { useEffect } from 'react';
import { useShallow } from 'zustand/shallow';
import {
  installWindowState,
  useWindowStore,
  type WindowState,
} from '@/shared/stores/windowStore';

export type { WindowState };

/**
 * 窗口态 / 窗口命令的 VM 门面：组件只从这里读 `state`、发命令，不直接碰 store。
 *
 * 真值在 `shared/stores/windowStore`（全站单例、单一 `onResized` 订阅）：
 * 全屏与否是**业务命令的输入**（如播放页退出守卫），命令层要能同步读，
 * 所以不能再由每个使用点各持一份局部 state。
 */
export function useWindowState() {
  // 兜底：直接渲染 App 而不走 bootstrap（如单测/组件预览）时也能拿到窗口态
  useEffect(() => {
    void installWindowState();
  }, []);

  return useWindowStore(
    useShallow((s) => ({
      state: s.state,
      toggleMaximize: s.toggleMaximize,
      toggleFullscreen: s.toggleFullscreen,
      exitFullscreen: s.exitFullscreen,
      minimize: s.minimize,
      close: s.close,
    })),
  );
}
