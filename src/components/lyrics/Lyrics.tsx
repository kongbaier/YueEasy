import { Music } from "lucide-react";
import type { ReactNode } from "react";
import { createContext, Suspense, use, useEffect, useState } from "react";
import { useLyricScroll } from "@/hooks/useLyricScroll";
import { useLyrics } from "@/hooks/useLyrics";
import { cn } from "@/lib/utils";
import { LyricLine } from "./LyricLine";

export function Lyrics({ className }: { className?: string }) {
  const { lines, index, hasLyrics } = useLyrics();
  const [contentWidth, setContentWidth] = useState(0);

  const { containerRef, contentRef, contentStyle } = useLyricScroll(
    index,
    hasLyrics,
  );

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      const newWidth = entries[0].contentRect.width;
      setContentWidth(newWidth);
    });
    observer.observe(el);

    return () => observer.disconnect();
  }, [containerRef]);

  return (
    <div
      className={cn("h-full w-full relative overflow-hidden", className)}
      ref={containerRef}
    >
      <Suspense
        fallback={
          <div className="flex-1 flex flex-col items-center justify-center gap-2 text-muted-foreground">
            <Music className="size-10 opacity-30" />
            <p className="text-xs">暂无歌词</p>
          </div>
        }
      >
        <LyricsProvider value={{ index, contentWidth }}>
          <ul
            className="space-y-2 mx-4 pb-4"
            ref={contentRef}
            style={contentStyle}
          >
            {lines.map((line, i) => (
              <LyricLine
                key={`${line.startMs}-${line.text.slice(0, 8)}`}
                line={line}
                lineIndex={i}
              />
            ))}
          </ul>
        </LyricsProvider>
      </Suspense>
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
