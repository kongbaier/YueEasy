import * as React from 'react';
import * as windowApi from '@/tauri/window';

/**
 * 返回当前系统缩放率，供纯函数 snapToDevicePixel 注入 dpr。
 *
 * - 取值来源始终是 `window.devicePixelRatio`（WebView2 同步、随每显示器 DPI 自动更新，
 *   与 Tauri 的 scaleFactor 是同一个值）；初始同步读取，避免首帧空窗。
 * - 变化触发用 Tauri 的 `onScaleChanged`（Rust `WindowEvent::ScaleFactorChanged` 的桥接），
 *   语义精确：只在 DPI/缩放真正变化时触发，不像 `window.resize` 会因窗口尺寸变化误触发。
 */
export function useDevicePixelRatio(): number {
  const [dpr, setDpr] = React.useState(() => window.devicePixelRatio || 1);

  React.useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;

    windowApi
      .onScaleChanged(() => {
        if (!disposed) setDpr(window.devicePixelRatio || 1);
      })
      .then((fn) => {
        if (disposed) fn();
        else unlisten = fn;
      })
      .catch(() => {
        // 监听失败不影响取值：初始值已同步读取，后续依赖组件自身重渲染。
      });

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);

  return dpr;
}
