import { useEffect } from 'react';

interface SystemAccentColors {
  accent: string;
  accent_dark1: string;
  accent_dark2: string;
  accent_dark3: string;
  accent_light1: string;
  accent_light2: string;
  accent_light3: string;
}

// 注入物理色阶变量（主题无关）；语义角色映射在 theme.css 中按主题完成
const mappings: Record<keyof SystemAccentColors, string> = {
  accent: '--brand',
  accent_dark1: '--brand-d1',
  accent_dark2: '--brand-d2',
  accent_dark3: '--brand-d3',
  accent_light1: '--brand-l1',
  accent_light2: '--brand-l2',
  accent_light3: '--brand-l3',
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
      import('@tauri-apps/api/core'),
      import('@tauri-apps/api/event'),
    ]).then(([{ invoke }, { listen }]) => {
      invoke<SystemAccentColors>('get_accent_color')
        .then(apply)
        .catch(() => {
          // Non-Windows or API failure — keep defaults
        });

      listen<SystemAccentColors>('accent-color-changed', (event) => {
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
