import type { Window } from "@tauri-apps/api/window";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useEffect } from "react";

type UseWindowDragOptions = {
  /** 是否启用双击最大化/还原，默认 true */
  doubleClick?: boolean;
  /** 触发拖拽前的鼠标移动阈值（像素），默认 3 */
  threshold?: number;
  /** 可注入外部 Window 实例（用于测试），默认自动获取 */
  appWindow?: Window;
};

const INTERACTIVE_SELECTOR =
  "button, a, input, textarea, select, [role='button'], [role='link']";

/**
 * 提供符合桌面端应用预期的窗口拖拽功能。
 *
 * 与 Tauri 内置的 `data-tauri-drag-region` 不同，此 hook 使用窗口级事件监听，
 * 通过 `window.startDragging()` 配合防误触阈值实现拖拽，能正确处理可交互子元素，
 * 并支持双击最大化/还原。
 *
 * @param dragAttr - 用于标记可拖拽区域的自定义属性名（不含 `data-` 前缀）；
 *                   实际查找 `data-${dragAttr}`
 * @param options - 可选配置
 *
 * @example
 * ```tsx
 * useWindowDrag("titlebar-drag");
 *
 * <header data-titlebar-drag>
 *   <span>标题</span>
 *   <button>按钮</button>
 * </header>
 * ```
 */
export function useWindowDrag(
  dragAttr: string,
  { doubleClick = true, threshold = 3, appWindow }: UseWindowDragOptions = {},
) {
  useEffect(() => {
    const attr = `data-${dragAttr}`;
    const currentWindow = appWindow ?? getCurrentWindow();

    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      const target = e.target;
      if (!(target instanceof HTMLElement)) return;

      // 不在拖拽区域内 → 忽略
      if (!target.closest(`[${attr}]`)) return;

      // 点击可交互元素（按钮、输入框等）时不触发拖拽
      if (target.closest(INTERACTIVE_SELECTOR)) return;

      // 双击 → 最大化/还原
      if (doubleClick && e.detail === 2) {
        currentWindow.toggleMaximize();
        return;
      }

      // 单击 → 鼠标移动超过阈值后开始拖拽
      if (e.detail === 1) {
        const startX = e.screenX;
        const startY = e.screenY;

        const cleanup = () => {
          window.removeEventListener("mousemove", onMouseMove);
          window.removeEventListener("mouseup", onMouseUp);
        };

        const onMouseMove = (moveEvent: MouseEvent) => {
          if (
            Math.abs(moveEvent.screenX - startX) > threshold ||
            Math.abs(moveEvent.screenY - startY) > threshold
          ) {
            cleanup();
            currentWindow.startDragging().catch(() => {});
          }
        };

        const onMouseUp = () => cleanup();

        window.addEventListener("mousemove", onMouseMove);
        window.addEventListener("mouseup", onMouseUp);
      }
    };

    window.addEventListener("mousedown", onMouseDown);

    return () => {
      window.removeEventListener("mousedown", onMouseDown);
    };
  }, [dragAttr, doubleClick, threshold, appWindow]);
}
