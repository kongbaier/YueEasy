import { useRef } from "react";
import type { PointerEvent as ReactPointerEvent, RefObject } from "react";

interface UseDragScrubOptions {
  axis?: "x" | "y";
  /** 拖动中实时回调（ratio 0..1） */
  onScrub?: (ratio: number) => void;
  /** 释放时回调（用最终 ratio） */
  onCommit?: (ratio: number) => void;
}

/** 把「按下 → 捕获 → move 换算比例 → up 释放」的指针拖拽样板收口到一处。 */
export function useDragScrub(
  barRef: RefObject<HTMLDivElement | null>,
  options: UseDragScrubOptions,
) {
  const { axis = "x" } = options;
  const ratioRef = useRef(0);

  const getRatio = (clientX: number, clientY: number) => {
    const bar = barRef.current;
    if (!bar) return 0;
    const rect = bar.getBoundingClientRect();
    if (axis === "y") {
      return (
        Math.max(0, Math.min(rect.bottom - clientY, rect.height)) / rect.height
      );
    }
    return Math.max(0, Math.min(clientX - rect.left, rect.width)) / rect.width;
  };

  const onPointerDown = (e: ReactPointerEvent) => {
    const bar = barRef.current;
    if (!bar) return;
    const ratio = getRatio(e.clientX, e.clientY);
    ratioRef.current = ratio;
    options.onScrub?.(ratio);

    const handleMove = (ev: PointerEvent) => {
      const r = getRatio(ev.clientX, ev.clientY);
      ratioRef.current = r;
      options.onScrub?.(r);
    };

    const handleUp = (ev: PointerEvent) => {
      options.onCommit?.(ratioRef.current);
      bar.releasePointerCapture(ev.pointerId);
      bar.removeEventListener("pointermove", handleMove);
      bar.removeEventListener("pointerup", handleUp);
    };

    bar.setPointerCapture(e.pointerId);
    bar.addEventListener("pointermove", handleMove);
    bar.addEventListener("pointerup", handleUp);
  };

  return onPointerDown;
}
