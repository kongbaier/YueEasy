import type { ReactNode } from "react";
import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { LenisScrollbar } from "@/components/lenis-scrollbar";
import { useLenis } from "@/hooks/useLenis";
import { cn } from "@/lib/utils";

interface LenisScrollProps {
  children: ReactNode;
  className?: string;
  overflowTop?: number;
}

export function LenisScroll({
  children,
  className,
  overflowTop = 0,
}: LenisScrollProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const { lenisRef, ready, resizeVersion, resize, scrollToTop } = useLenis(
    wrapperRef,
    contentRef,
  );
  const location = useLocation();

  useEffect(() => {
    scrollToTop();
    resize();
  }, [location.pathname, scrollToTop, resize]);

  return (
    <div className={cn("relative", className)}>
      <div className="absolute inset-0 overflow-hidden" ref={wrapperRef}>
        <div ref={contentRef} style={{ paddingTop: overflowTop }}>
          {children}
        </div>
      </div>
      <LenisScrollbar
        lenisRef={lenisRef}
        overflowTop={overflowTop}
        ready={ready}
        resizeVersion={resizeVersion}
      />
    </div>
  );
}
