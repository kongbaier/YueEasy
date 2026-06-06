import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

const USER_IDLE_MS = 3000;

export function useLyricScroll(activeLineIndex: number, enabled: boolean) {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLUListElement>(null);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isUserOperateRef = useRef(false);
  const prevIndexRef = useRef(-1);
  const recenterRef = useRef<(() => void) | null>(null);
  const hasPositionedRef = useRef(false);
  const [translateY, setTranslateY] = useState(0);
  const [hasPositioned, setHasPositioned] = useState(false);

  const clearIdleTimer = useCallback(() => {
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
  }, []);

  const setIsUserOperate = useCallback(
    (v: boolean) => {
      isUserOperateRef.current = v;
      clearIdleTimer();
      if (v) {
        idleTimerRef.current = setTimeout(() => {
          isUserOperateRef.current = false;
        }, USER_IDLE_MS);
      }
    },
    [clearIdleTimer],
  );

  useEffect(() => {
    prevIndexRef.current = activeLineIndex;
  }, [activeLineIndex]);

  useEffect(() => {
    if (!enabled) {
      hasPositionedRef.current = false;
      setHasPositioned(false);
    }
  }, [enabled]);

  const clampTranslate = useCallback((value: number) => {
    const container = containerRef.current;
    const content = contentRef.current;
    if (!container || !content) return value;

    const cHeight = container.getBoundingClientRect().height;
    const wHeight = content.getBoundingClientRect().height;
    const overflow = wHeight - cHeight;
    const max = overflow > 0 ? -overflow : 0;
    return Math.max(max, Math.min(0, value));
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      setIsUserOperate(true);
      setTranslateY((prev) => clampTranslate(prev - e.deltaY));
    };

    container.addEventListener("wheel", handleWheel, { passive: false });

    return () => {
      container.removeEventListener("wheel", handleWheel);
      clearIdleTimer();
    };
  }, [enabled, setIsUserOperate, clampTranslate, clearIdleTimer]);

  const recenter = useCallback(() => {
    const container = containerRef.current;
    const content = contentRef.current;
    if (!container || !content) return;

    const activeEl = container.querySelector(
      `[data-line="${activeLineIndex}"]`,
    );
    if (!activeEl) return;

    const cRect = container.getBoundingClientRect();
    const wRect = content.getBoundingClientRect();
    const lRect = activeEl.getBoundingClientRect();

    const containerHeight = cRect.height;
    const contentHeight = wRect.height;
    const lineCenter = lRect.top - wRect.top + lRect.height / 2;

    const ideal = containerHeight / 2 - lineCenter;
    const overflow = contentHeight - containerHeight;
    const maxTranslate = overflow > 0 ? -overflow : 0;

    setTranslateY(Math.max(maxTranslate, Math.min(0, ideal)));
  }, [activeLineIndex]);

  recenterRef.current = recenter;

  useLayoutEffect(() => {
    if (prevIndexRef.current !== activeLineIndex) {
      setIsUserOperate(false);
    }

    if (activeLineIndex < 0 || !enabled) return;
    if (isUserOperateRef.current) return;

    if (!hasPositionedRef.current) {
      recenter();
      hasPositionedRef.current = true;
      setHasPositioned(true);
      return;
    }

    const raf = requestAnimationFrame(() => {
      recenter();
    });

    return () => cancelAnimationFrame(raf);
  }, [activeLineIndex, enabled, setIsUserOperate, recenter]);

  useEffect(() => {
    if (!enabled) return;
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(() => {
      if (isUserOperateRef.current) return;
      recenterRef.current?.();
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, [enabled]);

  return {
    containerRef,
    contentRef,
    contentStyle: {
      transform: `translateY(${translateY}px)`,
      transition:
        !hasPositioned || isUserOperateRef.current
          ? "none"
          : "transform 0.3s ease-in-out",
    },
  };
}
