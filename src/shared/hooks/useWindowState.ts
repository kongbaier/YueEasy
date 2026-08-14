import { useEffect, useRef, useState } from 'react';
import * as windowApi from '@/shared/services/WindowService';

export type WindowState = 'normal' | 'maximized' | 'fullscreen';

function resolveState(max: boolean, full: boolean): WindowState {
  if (full) return 'fullscreen';
  if (max) return 'maximized';
  return 'normal';
}

/**
 * Shared window state machine that handles the Tauri bug where
 * maximize and fullscreen are mutually exclusive.
 *
 * State transitions:
 * - normal → maximize   (direct)
 * - normal → fullscreen  (direct)
 * - maximize → fullscreen: maximize → normal → fullscreen (remembers max to restore)
 * - fullscreen → maximize: fullscreen → normal → maximize
 */
export function useWindowState() {
  const [state, setState] = useState<WindowState>('normal');
  const wasMaximizedRef = useRef(false);

  useEffect(() => {
    Promise.all([windowApi.isMaximized(), windowApi.isFullscreen()]).then(
      ([max, full]) => setState(resolveState(max, full)),
    );

    const unlisten = windowApi.onResized(() => {
      Promise.all([windowApi.isMaximized(), windowApi.isFullscreen()]).then(
        ([max, full]) => setState(resolveState(max, full)),
      );
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  const toMaximize = async () => {
    if (state === 'fullscreen') {
      wasMaximizedRef.current = false;
      await windowApi.setFullscreen(false);
      await windowApi.maximize();
    } else if (state === 'normal') {
      await windowApi.maximize();
    }
  };

  const toFullscreen = async () => {
    if (state === 'maximized') {
      wasMaximizedRef.current = true;
      await windowApi.unmaximize();
      await windowApi.setFullscreen(true);
    } else if (state === 'normal') {
      wasMaximizedRef.current = false;
      await windowApi.setFullscreen(true);
    }
  };

  const toNormal = async () => {
    if (state === 'maximized') {
      await windowApi.unmaximize();
    } else if (state === 'fullscreen') {
      await windowApi.setFullscreen(false);
      if (wasMaximizedRef.current) {
        wasMaximizedRef.current = false;
        await windowApi.maximize();
      }
    }
  };

  const toggleMaximize = async () => {
    if (state === 'fullscreen') {
      wasMaximizedRef.current = false;
      await windowApi.setFullscreen(false);
      await windowApi.maximize();
    } else if (state === 'maximized') {
      await windowApi.unmaximize();
    } else {
      await windowApi.maximize();
    }
  };

  const toggleFullscreen = async () => {
    if (state === 'fullscreen') {
      await windowApi.setFullscreen(false);
      if (wasMaximizedRef.current) {
        wasMaximizedRef.current = false;
        await windowApi.maximize();
      }
    } else {
      if (state === 'maximized') {
        wasMaximizedRef.current = true;
        await windowApi.unmaximize();
      } else {
        wasMaximizedRef.current = false;
      }
      await windowApi.setFullscreen(true);
    }
  };

  const minimize = async () => {
    await windowApi.minimize();
  };

  const close = async () => {
    await windowApi.close();
  };

  return {
    state,
    toMaximize,
    toFullscreen,
    toNormal,
    toggleMaximize,
    toggleFullscreen,
    minimize,
    close,
  };
}
