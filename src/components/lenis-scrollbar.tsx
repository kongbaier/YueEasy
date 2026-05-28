import type Lenis from "lenis";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface LenisScrollbarProps {
  lenisRef: React.RefObject<Lenis | null>;
  ready: boolean;
  className?: string;
  /** 滚动条顶部偏移，对应 header 高度 */
  overflowTop?: number;
}

const STEP = 80;

export function LenisScrollbar({
  lenisRef,
  ready,
  className,
  overflowTop = 0,
}: LenisScrollbarProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [thumbHeight, setThumbHeight] = useState(0);
  const [thumbTop, setThumbTop] = useState(0);
  const [visible, setVisible] = useState(false);
  const scrollInfo = useRef({ maxScroll: 0, animatedScroll: 0 });
  const dragState = useRef({
    active: false,
    startY: 0,
    startScroll: 0,
    thumbH: 0,
  });

  const updateThumb = useCallback(() => {
    const lenis = lenisRef.current;
    if (!lenis) return;

    const { scrollHeight, height: viewportHeight } = lenis.dimensions;
    const effectiveViewport = viewportHeight - overflowTop;
    const maxScroll = scrollHeight - viewportHeight;
    scrollInfo.current.maxScroll = maxScroll;
    scrollInfo.current.animatedScroll = lenis.animatedScroll;

    if (scrollHeight <= effectiveViewport) {
      setVisible(false);
      return;
    }

    setVisible(true);

    const trackHeight = trackRef.current?.offsetHeight ?? effectiveViewport;
    const ratio = effectiveViewport / scrollHeight;
    const thumbH = Math.max(Math.round(ratio * trackHeight), 24);
    dragState.current.thumbH = thumbH;
    setThumbHeight(thumbH);

    const scrollRatio = maxScroll > 0 ? lenis.animatedScroll / maxScroll : 0;
    const thumbT = scrollRatio * (trackHeight - thumbH);
    setThumbTop(thumbT);
  }, [lenisRef, overflowTop]);

  useEffect(() => {
    if (!ready) return;

    const lenis = lenisRef.current;
    if (!lenis) return;

    const unsub = lenis.on("scroll", updateThumb);
    const raf = requestAnimationFrame(() => updateThumb());

    return () => {
      unsub();
      cancelAnimationFrame(raf);
    };
  }, [ready, lenisRef, updateThumb]);

  const scrollBy = useCallback(
    (delta: number) => {
      const lenis = lenisRef.current;
      if (!lenis) return;
      const { maxScroll } = scrollInfo.current;
      const target = Math.max(
        0,
        Math.min(maxScroll, lenis.animatedScroll + delta),
      );
      lenis.scrollTo(target);
    },
    [lenisRef],
  );

  const handleTrackClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target !== trackRef.current) return;

      const lenis = lenisRef.current;
      const track = trackRef.current;
      if (!lenis || !track) return;

      const { maxScroll } = scrollInfo.current;
      const rect = track.getBoundingClientRect();
      const ratio = Math.max(
        0,
        Math.min(1, (e.clientY - rect.top) / rect.height),
      );
      lenis.scrollTo(ratio * maxScroll);
    },
    [lenisRef],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const { maxScroll } = scrollInfo.current;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          scrollBy(STEP);
          break;
        case "ArrowUp":
          e.preventDefault();
          scrollBy(-STEP);
          break;
        case "PageDown":
          e.preventDefault();
          scrollBy(window.innerHeight);
          break;
        case "PageUp":
          e.preventDefault();
          scrollBy(-window.innerHeight);
          break;
        case "Home":
          e.preventDefault();
          lenisRef.current?.scrollTo(0);
          break;
        case "End":
          e.preventDefault();
          lenisRef.current?.scrollTo(maxScroll);
          break;
      }
    },
    [lenisRef, scrollBy],
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const lenis = lenisRef.current;
      if (!lenis) return;

      dragState.current = {
        active: true,
        startY: e.clientY,
        startScroll: lenis.animatedScroll,
        thumbH: dragState.current.thumbH,
      };

      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [lenisRef],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      const state = dragState.current;
      if (!state.active) return;

      const lenis = lenisRef.current;
      const track = trackRef.current;
      if (!lenis || !track) return;

      const { maxScroll } = scrollInfo.current;
      if (maxScroll <= 0) return;

      const trackHeight = track.offsetHeight;
      const dy = e.clientY - state.startY;
      const scale = maxScroll / (trackHeight - state.thumbH);
      const target = state.startScroll + dy * scale;
      lenis.scrollTo(Math.max(0, Math.min(maxScroll, target)), {
        immediate: true,
      });
    },
    [lenisRef],
  );

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    dragState.current.active = false;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  }, []);

  return (
    <div
      aria-controls="lenis-content"
      aria-orientation="vertical"
      aria-valuemax={Math.round(scrollInfo.current.maxScroll)}
      aria-valuemin={0}
      aria-valuenow={Math.round(scrollInfo.current.animatedScroll)}
      className={cn(
        "absolute right-0 bottom-0 z-10 outline-none",
        "w-1.5 hover:w-2.5 focus-visible:w-2.5",
        "rounded-full bg-[rgba(128,128,128,0.1)] dark:bg-[rgba(255,255,255,0.08)]",
        "transition-all duration-150",
        !visible && "opacity-0 pointer-events-none",
        className,
      )}
      onClick={handleTrackClick}
      onKeyDown={handleKeyDown}
      ref={trackRef}
      role="scrollbar"
      style={{ top: overflowTop }}
      tabIndex={0}
    >
      <div
        className={cn(
          "absolute left-0 right-0 rounded-full cursor-pointer",
          "bg-[rgba(128,128,128,0.3)] dark:bg-[rgba(255,255,255,0.2)]",
          "hover:bg-[rgba(128,128,128,0.45)] dark:hover:bg-[rgba(255,255,255,0.35)]",
          "active:bg-[rgba(128,128,128,0.55)] dark:active:bg-[rgba(255,255,255,0.45)]",
        )}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        style={{
          height: thumbHeight,
          transform: `translateY(${thumbTop}px)`,
        }}
      />
    </div>
  );
}
