import { useCallback, useEffect, useRef, useState } from "react";

interface CustomScrollProps {
  children: React.ReactNode;
  className?: string;
  resetKey?: string;
}

export function CustomScroll({
  children,
  className,
  resetKey,
}: CustomScrollProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [maxScroll, setMaxScroll] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);
  const [showScrollbar, setShowScrollbar] = useState(false);
  const [scrollPercent, setScrollPercent] = useState(0);
  const isDraggingRef = useRef(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout>>(null);
  const targetScrollRef = useRef(0);
  const currentScrollRef = useRef(0);
  const rafRef = useRef(0);
  const dragRef = useRef({ startY: 0, startScroll: 0 });
  const translateRef = useRef<number>(0);

  const flashScrollbar = useCallback(() => {
    setShowScrollbar(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => {
      if (!isDraggingRef.current) setShowScrollbar(false);
    }, 1200);
  }, []);

  const clamp = useCallback(
    (v: number) => Math.max(0, Math.min(v, maxScroll)),
    [maxScroll],
  );

  const updateTransform = useCallback(
    (scroll: number) => {
      const clamped = clamp(scroll);
      currentScrollRef.current = clamped;
      translateRef.current = -clamped;
      if (contentRef.current) {
        contentRef.current.style.transform = `translateY(${-clamped}px)`;
      }
      const pct = maxScroll > 0 ? clamped / maxScroll : 0;
      setScrollPercent(pct);
    },
    [clamp, maxScroll],
  );

  const animate = useCallback(() => {
    const target = targetScrollRef.current;
    const current = currentScrollRef.current;
    if (Math.abs(target - current) < 0.5) {
      if (target !== current) {
        updateTransform(target);
      }
      rafRef.current = 0;
      return;
    }
    const next = current + (target - current) * 0.25;
    updateTransform(next);
    rafRef.current = requestAnimationFrame(animate);
  }, [updateTransform]);

  const scheduleScroll = useCallback(
    (next: number) => {
      targetScrollRef.current = clamp(next);
      if (!rafRef.current) {
        rafRef.current = requestAnimationFrame(animate);
      }
    },
    [clamp, animate],
  );

  const measure = useCallback(() => {
    const container = containerRef.current;
    const content = contentRef.current;
    if (!container || !content) return;
    const ch = container.clientHeight;
    const sh = content.scrollHeight;
    setContainerHeight(ch);
    const max = Math.max(0, sh - ch);
    setMaxScroll(max);
    if (currentScrollRef.current > max) {
      scheduleScroll(max);
    }
  }, [scheduleScroll]);

  useEffect(() => {
    measure();
    const container = containerRef.current;
    const content = contentRef.current;
    if (!container || !content) return;
    const ro = new ResizeObserver(measure);
    ro.observe(container);
    ro.observe(content);
    return () => ro.disconnect();
  }, [measure]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: resetKey triggers scroll reset
  useEffect(() => {
    targetScrollRef.current = 0;
    currentScrollRef.current = 0;
    translateRef.current = 0;
    setScrollPercent(0);
    if (contentRef.current) {
      contentRef.current.style.transform = "translateY(0px)";
    }
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
  }, [resetKey]);

  const wheelDeltaRef = useRef(0);
  const wheelRafRef = useRef(0);

  const handleWheel = useCallback(
    (e: WheelEvent) => {
      e.preventDefault();
      wheelDeltaRef.current += e.deltaY;
      flashScrollbar();
      if (!wheelRafRef.current) {
        wheelRafRef.current = requestAnimationFrame(() => {
          const delta = wheelDeltaRef.current;
          wheelDeltaRef.current = 0;
          wheelRafRef.current = 0;
          scheduleScroll(targetScrollRef.current + delta);
        });
      }
    },
    [flashScrollbar, scheduleScroll],
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => container.removeEventListener("wheel", handleWheel);
  }, [handleWheel]);

  const handleThumbMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      isDraggingRef.current = true;
      setShowScrollbar(true);
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
      }
      dragRef.current = {
        startY: e.clientY,
        startScroll: targetScrollRef.current,
      };

      const handleMouseMove = (ev: MouseEvent) => {
        const thumbH = Math.max(
          20,
          (containerHeight / (containerHeight + maxScroll)) * containerHeight,
        );
        const trackSpace = containerHeight - thumbH;
        if (trackSpace <= 0) return;
        const deltaY = ev.clientY - dragRef.current.startY;
        const ratio = deltaY / trackSpace;
        const next = clamp(dragRef.current.startScroll + ratio * maxScroll);
        targetScrollRef.current = next;
        updateTransform(next);
      };

      const handleMouseUp = () => {
        isDraggingRef.current = false;
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
        flashScrollbar();
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [clamp, containerHeight, maxScroll, updateTransform, flashScrollbar],
  );

  const handleTrackClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const rect = e.currentTarget.getBoundingClientRect();
      const thumbH = Math.max(
        20,
        (containerHeight / (containerHeight + maxScroll)) * containerHeight,
      );
      const trackSpace = containerHeight - thumbH;
      if (trackSpace <= 0) return;
      const clickY = e.clientY - rect.top - thumbH / 2;
      const ratio = Math.max(0, Math.min(1, clickY / trackSpace));
      scheduleScroll(ratio * maxScroll);
      flashScrollbar();
    },
    [containerHeight, maxScroll, scheduleScroll, flashScrollbar],
  );

  const thumbHeight =
    maxScroll > 0
      ? Math.max(
          20,
          (containerHeight / (containerHeight + maxScroll)) * containerHeight,
        )
      : 0;
  const thumbTop =
    maxScroll > 0 && containerHeight > 0
      ? scrollPercent * (containerHeight - thumbHeight)
      : 0;

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: scroll container with hover state
    <div
      className={`relative h-full ${className ?? ""}`}
      onMouseEnter={() => setShowScrollbar(true)}
      onMouseLeave={() => !isDraggingRef.current && setShowScrollbar(false)}
      ref={containerRef}
    >
      <div ref={contentRef}>{children}</div>
      {maxScroll > 0 && (
        // biome-ignore lint/a11y/noStaticElementInteractions: custom scrollbar track with mouse events
        <div
          className="absolute right-0.5 top-0 h-full w-1.5"
          onMouseDown={handleTrackClick}
        >
          {/* biome-ignore lint/a11y/noStaticElementInteractions: scrollbar thumb with drag handler */}
          <div
            className="absolute right-0 w-1.5 cursor-pointer rounded-full transition-opacity duration-200"
            onMouseDown={handleThumbMouseDown}
            style={{
              height: thumbHeight,
              top: thumbTop,
              opacity: showScrollbar || isDraggingRef.current ? 1 : 0,
              background: isDraggingRef.current
                ? "rgba(255,255,255,0.5)"
                : "rgba(255,255,255,0.2)",
            }}
          />
        </div>
      )}
    </div>
  );
}
