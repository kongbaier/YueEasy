import { Loader2, Music } from "lucide-react";
import type { ReactNode } from "react";
import { createContext, use, useEffect, useState } from "react";
import { useLyricScroll } from "@/hooks/useLyricScroll";
import { useLyrics } from "@/hooks/useLyrics";
import { cn } from "@/lib/utils";
import { usePlayerStore } from "@/stores";
import { LyricLine } from "./LyricLine";

export function Lyrics({ className }: { className?: string }) {
  const { lines, index, hasLyrics, isLoading } = useLyrics();
  const trackId = usePlayerStore((s) => s.currentTrack?.id);
  const [contentWidth, setContentWidth] = useState(0);

  const { containerRef, contentRef, contentStyle } = useLyricScroll(
    index,
    hasLyrics,
    trackId,
  );

  useEffect(() => {
    if (!hasLyrics) return;
    if (!contentRef.current) return;
    const observer = new ResizeObserver((entries) => {
      const newWidth = entries[0].contentRect.width;
      setContentWidth(newWidth);
    });
    observer.observe(contentRef.current);
    return () => observer.disconnect();
  }, [contentRef, hasLyrics]);

  // 加载中
  if (isLoading) {
    return (
      <div className={cn("h-full flex flex-col", className)}>
        <div className="flex-1 flex flex-col items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="size-8 animate-spin opacity-30" />
          <p className="text-xs">加载中...</p>
        </div>
      </div>
    );
  }

  // 无歌词
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

  // 有歌词
  return (
    <div className={cn("h-full flex flex-col", className)}>
      <div
        className="relative overflow-hidden flex-1 mb-4"
        ref={containerRef}
      >
        <ul className="space-y-2 mx-4" ref={contentRef} style={contentStyle}>
          <LyricsProvider value={{ index, contentWidth }}>
            {lines.map((line, i) => (
              <LyricLine
                key={`${line.startMs}-${line.text.slice(0, 8)}`}
                line={line}
                lineIndex={i}
              />
            ))}
          </LyricsProvider>
        </ul>
      </div>
    </div>
  );
}

interface LyricsContextValue {
  index: number;
  contentWidth: number;
}

const LyricsContext = createContext<LyricsContextValue | null>(null);

export function LyricsProvider({
  children,
  value,
}: {
  children: ReactNode;
  value: LyricsContextValue;
}) {
  return (
    <LyricsContext.Provider value={value}>{children}</LyricsContext.Provider>
  );
}

export function useLyricsContext(): LyricsContextValue {
  const ctx = use(LyricsContext);
  if (!ctx) {
    throw new Error("useLyricsContext must be used within <LyricsProvider>");
  }
  return ctx;
}
