import type { ReactNode } from "react";
import { useRef } from "react";
import { LenisScrollbar } from "@/components/lenis-scrollbar";
import { useLenis } from "@/hooks/useLenis";
import { cn } from "@/lib/utils";

interface LenisScrollProps {
  children: ReactNode;
  className?: string;
  /** 允许内容向上溢出 wrapper 的像素值，配合 backdrop-blur header 使用 */
  overflowTop?: number;
}

export function LenisScroll({
  children,
  className,
  overflowTop = 0,
}: LenisScrollProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const { lenisRef, ready } = useLenis(wrapperRef, contentRef);

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
      />
    </div>
  );
}
