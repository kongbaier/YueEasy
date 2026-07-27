import { Loader2, Music } from "lucide-react";
import type { ReactNode } from "react";
import { createContext, use, useMemo } from "react";
import { cn } from "@/shared/lib/utils";
import { usePlayerStore } from "@/stores";
import { LyricLine } from "./LyricLine";
import { useLyricScroll } from "../hooks/useLyricScroll";
import { useLyrics } from "../hooks/useLyrics";

export const Lyrics = ({ className }: { className?: string }) => {
  const {
    lines,
    index,
    hasLyrics,
    isLoading,
    currentWordIndex,
    wordProgress,
    hasWordLyrics,
    translatedLyric,
  } = useLyrics();
  const trackId = usePlayerStore((s) => s.currentTrack?.id);

  const { containerRef, contentRef, contentStyle } = useLyricScroll(
    index,
    hasLyrics,
    trackId,
  );

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

  const contextValue = useMemo(
    () => ({
      index,
      hasWordLyrics,
      translatedLyric,
    }),
    [index, hasWordLyrics, translatedLyric],
  );

  // 有歌词
  return (
    <div className={cn("h-full flex flex-col", className)}>
      <div className="relative overflow-hidden flex-1 mb-4" ref={containerRef}>
        <ul
          className="space-y-2 mx-4 font-sans w-full"
          ref={contentRef}
          style={contentStyle}
        >
          <LyricsProvider value={contextValue}>
            {lines.map((line, i) => (
              <LyricLine
                key={`${line.startMs}-${line.text.slice(0, 8)}`}
                line={line}
                lineIndex={i}
                currentWordIndex={i === index ? currentWordIndex : -1}
                wordProgress={i === index ? wordProgress : 0}
              />
            ))}
          </LyricsProvider>
        </ul>
      </div>
    </div>
  );
};

interface LyricsContextValue {
  index: number;
  hasWordLyrics: boolean;
  translatedLyric: string[];
}

const LyricsContext = createContext<LyricsContextValue | null>(null);

export const LyricsProvider = ({
  children,
  value,
}: {
  children: ReactNode;
  value: LyricsContextValue;
}) => {
  return (
    <LyricsContext.Provider value={value}>{children}</LyricsContext.Provider>
  );
};

export const useLyricsContext = (): LyricsContextValue => {
  const ctx = use(LyricsContext);
  if (!ctx) {
    throw new Error("useLyricsContext must be used within <LyricsProvider>");
  }
  return ctx;
};
