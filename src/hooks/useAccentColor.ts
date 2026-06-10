import { useEffect } from "react";

interface SystemAccentColors {
  accent: string;
  accent_dark1: string;
  accent_dark2: string;
  accent_dark3: string;
  accent_light1: string;
  accent_light2: string;
  accent_light3: string;
}

const mappings: Record<keyof SystemAccentColors, string> = {
  accent: "--primary",
  accent_dark1: "--primary-dark",
  accent_dark2: "--primary-darker",
  accent_dark3: "--primary-darkest",
  accent_light1: "--primary-light",
  accent_light2: "--primary-lighter",
  accent_light3: "--primary-lightest",
};

function apply(colors: SystemAccentColors) {
  for (const [key, prop] of Object.entries(mappings)) {
    document.documentElement.style.setProperty(
      prop,
      colors[key as keyof SystemAccentColors],
    );
  }
}

export const useAccentColor = () => {
  useEffect(() => {
    let unlisten: (() => void) | undefined;

    Promise.all([
      import("@tauri-apps/api/core"),
      import("@tauri-apps/api/event"),
    ]).then(([{ invoke }, { listen }]) => {
      invoke<SystemAccentColors>("get_accent_color")
        .then(apply)
        .catch(() => {
          // Non-Windows or API failure — keep defaults
        });

      listen<SystemAccentColors>("accent-color-changed", (event) => {
        apply(event.payload);
      }).then((fn) => {
        unlisten = fn;
      });
    });

    return () => {
      unlisten?.();
    };
  }, []);
};
