import { useCallback, useEffect, useRef } from 'react';
import * as windowApi from '@/shared/services/WindowService';
import { useSettingsStore } from '@/stores/settings';

function getSystemTheme(): 'light' | 'dark' {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

export const useThemeSync = () => {
  const theme = useSettingsStore((s) => s.appearance.theme);
  const transitionTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const syncThemeClass = useCallback((resolved: 'light' | 'dark') => {
    const root = document.documentElement;
    clearTimeout(transitionTimer.current);
    root.classList.add('theme-transition');
    requestAnimationFrame(() => {
      root.classList.toggle('dark', resolved === 'dark');
    });
    transitionTimer.current = setTimeout(() => {
      root.classList.remove('theme-transition');
    }, 500);
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
