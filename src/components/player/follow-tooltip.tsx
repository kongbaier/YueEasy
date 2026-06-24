import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

interface FollowTooltipProps {
  open: boolean;
  /** Cursor x position relative to the anchor element */
  x: number;
  /** The anchor element ref (the bar/slider being hovered) */
  anchorRef: React.RefObject<HTMLElement | null>;
  children: React.ReactNode;
  className?: string;
  /** Gap between tooltip and anchor in px */
  gap?: number;
  /** Minimum distance from viewport edges in px */
  padding?: number;
}

export function FollowTooltip({
  open,
  x,
  anchorRef,
  children,
  className,
  gap = 8,
  padding = 8,
}: FollowTooltipProps) {
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    if (!open || !anchorRef.current || !tooltipRef.current) {
      setPos(null);
      return;
    }

    const anchorRect = anchorRef.current.getBoundingClientRect();
    const ttRect = tooltipRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // Prefer above the anchor
    let top = anchorRect.top - ttRect.height - gap;
    if (top < padding) {
      // Flip to below
      top = anchorRect.bottom + gap;
    }
    // If below also overflows, clamp to viewport bottom
    if (top + ttRect.height > vh - padding) {
      top = vh - ttRect.height - padding;
    }

    // Center on cursor x, then clamp horizontally
    let left = anchorRect.left + x - ttRect.width / 2;
    left = Math.max(padding, Math.min(left, vw - ttRect.width - padding));

    setPos({ top, left });
  }, [open, x, anchorRef, gap, padding]);

  return createPortal(
    <div
      className={cn(
        "pointer-events-none px-1.5 py-2 rounded-md text-xs tabular-nums z-9999",
        "bg-popover text-popover-foreground border border-border shadow-md",
        className,
      )}
      ref={tooltipRef}
      style={
        pos
          ? { position: "fixed", top: pos.top, left: pos.left }
          : { position: "fixed", top: 0, left: 0, visibility: "hidden" }
      }
    >
      {children}
    </div>,
    document.body,
  );
}
