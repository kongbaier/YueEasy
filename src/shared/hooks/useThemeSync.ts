import { useCallback, useEffect } from 'react';
import * as windowApi from '@/tauri/window';
import { runViewTransition } from '@/shared/lib/viewTransition';
import { useAppSettingsStore } from '@/shared/stores/appSettingsStore';

function getSystemTheme(): 'light' | 'dark' {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

/**
 * View Transition 的最小形状声明已上收到 `shared/lib/viewTransition`
 * （`Document.startViewTransition` 在 lib.dom 里的可用性随 TS 版本变化）。
 */
export const useThemeSync = () => {
  const theme = useAppSettingsStore((s) => s.appearance.theme);

  /**
   * 切换 `.dark`（以及随之而来的整套语义色）。
   *
   * 走 View Transition 的**双快照交叉淡出**（`runViewTransition`，kind = `theme`），
   * 而不是「过渡那十几个 @property 颜色变量」：
   * 后者要在这 400ms 里对整棵文档每帧重算样式并重绘 —— 十几个 `inherits: true` 的变量
   * 每帧都在变，几乎所有元素的 background / border / shadow 都要跟着重画，是一次
   * 稳定可感知的掉帧（半透明 Mica 窗口下更贵）。View Transition 只在切换瞬间各截一张
   * 整屏快照，之后是合成层上的 opacity 淡入淡出，代价从「每帧全文档重绘」降到「一次光栅化」。
   *
   * 不可用（旧版 WebView2）或用户要求减少动效时由 `runViewTransition` 退化为瞬时切换，
   * 这里不再自己判断。
   */
  const syncThemeClass = useCallback((resolved: 'light' | 'dark') => {
    const root = document.documentElement;

    runViewTransition(
      () => {
        root.classList.toggle('dark', resolved === 'dark');
      },
      { kind: 'theme' },
    );
  }, []);

  useEffect(() => {
    let unlisten: (() => void) | undefined;

    const sync = async () => {
      if (theme === 'system') {
        await windowApi.setTheme(null);
        syncThemeClass(getSystemTheme());
        unlisten = await windowApi.onThemeChanged((resolved) => {
          syncThemeClass(resolved);
        });
      } else {
        await windowApi.setTheme(theme);
        syncThemeClass(theme);
      }
    };

    sync();

    return () => {
      unlisten?.();
    };
  }, [theme, syncThemeClass]);

  // Keep localStorage in sync for theme-init.js preload script
  useEffect(() => {
    localStorage.setItem('theme', theme);
  }, [theme]);
};
