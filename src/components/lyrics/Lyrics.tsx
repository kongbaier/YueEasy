import { Music } from "lucide-react";
import { useLyricScroll } from "@/hooks/useLyricScroll";
import { useLyrics } from "@/hooks/useLyrics";
import { cn } from "@/lib/utils";
import { LyricLine } from "./LyricLine";

export function Lyrics({ className }: { className?: string }) {
  const { lines, tlines, activeLineIndex, hasLyrics } = useLyrics();

  const { containerRef, contentRef, contentStyle } = useLyricScroll(
    activeLineIndex,
    hasLyrics,
  );

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
        <ul className="space-y-2 mx-4" ref={contentRef} style={contentStyle}>
          {lines.map((line, i) => (
            <LyricLine
              isActive={i === activeLineIndex}
              isPast={i < activeLineIndex}
              key={line.startMs}
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
