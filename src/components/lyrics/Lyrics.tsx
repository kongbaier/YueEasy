import { Music } from "lucide-react";
import { useEffect, useState } from "react";
import { useLyricScroll } from "@/hooks/useLyricScroll";
import { useLyrics } from "@/hooks/useLyrics";
import { cn } from "@/lib/utils";
import { LyricLine } from "./LyricLine";

const ACTIVE_SCALE = 1.1;

export function Lyrics({ className }: { className?: string }) {
  const { lines, tlines, activeLineIndex, hasLyrics } = useLyrics();
  const [layoutWidth, setLayoutWidth] = useState<number | undefined>(undefined);

  const { containerRef, contentRef, contentStyle } = useLyricScroll(
    activeLineIndex,
    hasLyrics,
  );

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let rafId = 0;
    const ro = new ResizeObserver(([entry]) => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const w = entry.contentRect.width - 32; // mx-4 = 16px each side
        setLayoutWidth(w > 0 ? w / ACTIVE_SCALE : 0);
      });
    });
    ro.observe(el);
    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
    };
  }, [containerRef]);

  if (!hasLyrics) {
    return (
      <div className={cn("h-full flex flex-col", className)}>
        <div className="flex-1 flex flex-col items-center justify-center gap-2 text-muted-foreground">
          <Music className="size-10 opacity-30" />
          <p className="text-xs">暂无歌词</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("h-full flex flex-col", className)}>
      <div className="relative overflow-hidden flex-1" ref={containerRef}>
        <ul
          className="space-y-2 mx-4 pb-4"
          ref={contentRef}
          style={contentStyle}
        >
          {lines.map((line, i) => (
            <LyricLine
              activeScale={ACTIVE_SCALE}
              isActive={i === activeLineIndex}
              isPast={i < activeLineIndex}
              key={line.startMs}
              layoutWidth={layoutWidth}
              line={line}
              lineIndex={i}
              tline={tlines[i]}
            />
          ))}
        </ul>
      </div>
    </div>
  );
}
