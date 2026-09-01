import { useEffect, useRef, useState } from 'react';
import { useAppSettingsStore } from "@/stores/appSettingsStore";
import * as windowApi from "@/tauri/window";

export type WindowState = 'normal' | 'maximized' | 'fullscreen';

const resolveState = (max: boolean, full: boolean): WindowState => {
  if (full) return 'fullscreen';
  if (max) return 'maximized';
  return 'normal';
}

export function useWindowState() {
  const [state, setState] = useState<WindowState>('normal');
  const wasMaximizedRef = useRef(false);

  useEffect(() => {
    const getWindowState = async () => {
      const [max, full] = await Promise.all([
        windowApi.isMaximized(),
        windowApi.isFullscreen(),
      ]);
      setState(resolveState(max, full));
    };

    getWindowState();

    const unlistenPromise = windowApi.onResized(getWindowState);

    return () => {
      unlistenPromise.then((fn) => fn());
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
    const { closeBehavior } = useAppSettingsStore.getState().appearance;
    if (closeBehavior === "hide") {
      await windowApi.hide();
    } else {
      await windowApi.close();
    }
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
