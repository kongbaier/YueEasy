import { useEffect } from 'react';
import { installFocusNavigation } from '@/shared/lib/focus';

/**
 * 启用区域焦点导航（Tab 走区域、方向键走区域内条目）。
 *
 * 全局只需安装一次（`AppLayout`）。标记约定见 `shared/lib/focus` 与 AGENTS.md：
 * UI 里给「一个区域」加 `data-focus-zone`，浮层根加 `data-focus-layer`。
 */
export const useFocusNavigation = () => {
  useEffect(() => installFocusNavigation(), []);
};
