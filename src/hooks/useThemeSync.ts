import { getCurrentWindow } from "@tauri-apps/api/window";
import { useCallback, useEffect, useRef } from "react";
import { useUiStore } from "@/stores";

function getSystemTheme(): "light" | "dark" {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function useThemeSync() {
  const theme = useUiStore((s) => s.theme);
  const transitionTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const syncThemeClass = useCallback((resolved: "light" | "dark") => {
    const root = document.documentElement;
    clearTimeout(transitionTimer.current);
    root.classList.add("theme-transition");
    requestAnimationFrame(() => {
      root.classList.toggle("dark", resolved === "dark");
    });
    transitionTimer.current = setTimeout(() => {
      root.classList.remove("theme-transition");
    }, 500);
  }, []);

  useEffect(() => {
    let unlisten: (() => void) | undefined;

    const sync = async () => {
      if (theme === "system") {
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
}
