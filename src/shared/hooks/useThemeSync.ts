import { getCurrentWindow } from '@tauri-apps/api/window';
import { useCallback, useEffect, useRef } from 'react';
import { useAppSettings } from '@/stores/settings';

function getSystemTheme(): 'light' | 'dark' {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

export const useThemeSync = () => {
  const theme = useAppSettings((s) => s.settings.theme);
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
        await getCurrentWindow().setTheme(null);
        syncThemeClass(getSystemTheme());
        unlisten = await getCurrentWindow().onThemeChanged(({ payload }) => {
          syncThemeClass(payload);
        });
      } else {
        await getCurrentWindow().setTheme(theme);
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
