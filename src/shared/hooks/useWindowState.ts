import { getCurrentWindow } from '@tauri-apps/api/window';
import { useEffect, useRef, useState } from 'react';

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
  const appWindow = getCurrentWindow();
  const [state, setState] = useState<WindowState>('normal');
  const wasMaximizedRef = useRef(false);

  useEffect(() => {
    Promise.all([appWindow.isMaximized(), appWindow.isFullscreen()]).then(
      ([max, full]) => setState(resolveState(max, full)),
    );

    const unlisten = appWindow.onResized(() => {
      Promise.all([appWindow.isMaximized(), appWindow.isFullscreen()]).then(
        ([max, full]) => setState(resolveState(max, full)),
      );
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, [appWindow]);

  const toMaximize = async () => {
    if (state === 'fullscreen') {
      wasMaximizedRef.current = false;
      await appWindow.setFullscreen(false);
      await appWindow.maximize();
    } else if (state === 'normal') {
      await appWindow.maximize();
    }
  };

  const toFullscreen = async () => {
    if (state === 'maximized') {
      wasMaximizedRef.current = true;
      await appWindow.unmaximize();
      await appWindow.setFullscreen(true);
    } else if (state === 'normal') {
      wasMaximizedRef.current = false;
      await appWindow.setFullscreen(true);
    }
  };

  const toNormal = async () => {
    if (state === 'maximized') {
      await appWindow.unmaximize();
    } else if (state === 'fullscreen') {
      await appWindow.setFullscreen(false);
      if (wasMaximizedRef.current) {
        wasMaximizedRef.current = false;
        await appWindow.maximize();
      }
    }
  };

  const toggleMaximize = async () => {
    if (state === 'fullscreen') {
      wasMaximizedRef.current = false;
      await appWindow.setFullscreen(false);
      await appWindow.maximize();
    } else if (state === 'maximized') {
      await appWindow.unmaximize();
    } else {
      await appWindow.maximize();
    }
  };

  const toggleFullscreen = async () => {
    if (state === 'fullscreen') {
      await appWindow.setFullscreen(false);
      if (wasMaximizedRef.current) {
        wasMaximizedRef.current = false;
        await appWindow.maximize();
      }
    } else {
      if (state === 'maximized') {
        wasMaximizedRef.current = true;
        await appWindow.unmaximize();
      } else {
        wasMaximizedRef.current = false;
      }
      await appWindow.setFullscreen(true);
    }
  };

  return { state, toMaximize, toFullscreen, toNormal, toggleMaximize, toggleFullscreen };
}
