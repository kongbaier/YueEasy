import { Loader2, Music } from 'lucide-react';
import type { ReactNode } from 'react';
import { createContext, use } from 'react';
import { cn } from '@/shared/lib/utils';
import { LyricLine } from './LyricLine';
import { useLyricScroll } from '../hooks/useLyricScroll';
import { useLyrics } from '../hooks/useLyrics';
import { useQuery } from '@tanstack/react-query';
import { fetchLyrics } from '../lyricsService';
import { useQueueStore } from '@/modules/player/stores/queue';

export const Lyrics = ({ className }: { className?: string }) => {
  const trackId = useQueueStore((s) => s.currentTrack?.id);
  const { data, isLoading } = useQuery({
    queryKey: ['lyrics', trackId],
    queryFn: () => {
      if (!trackId) return { lyric: [], tlyric: [], yrc: [] };
      return fetchLyrics(trackId);
    },
    enabled: Boolean(trackId),
    staleTime: Infinity,
  });
  const { lines, active, hasLyrics, hasYrc, tlyric } = useLyrics(data);
  const [activeLine, activeWord] = active;

  const { containerRef, contentRef, contentStyle } = useLyricScroll(
    activeLine,
    hasLyrics,
    trackId,
  );

  if (isLoading) {
    return (
      <div className={cn('h-full flex flex-col', className)}>
        <div className="flex-1 flex flex-col items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="size-8 animate-spin opacity-30" />
          <p className="text-xs">加载中...</p>
        </div>
      </div>
    );
  }

  if (!hasLyrics) {
    return (
      <div className={cn('h-full flex flex-col', className)}>
        <div className="flex-1 flex flex-col items-center justify-center gap-2 text-muted-foreground">
          <Music className="size-10 opacity-30" />
          <p className="text-xs">暂无歌词</p>
        </div>
      </div>
    );
  }

  // 有歌词
  return (
    <div className={cn('h-full flex flex-col', className)}>
      <div className="relative overflow-hidden flex-1 mb-4" ref={containerRef}>
        <ul
          className="space-y-2 mx-4 font-sans w-full"
          ref={contentRef}
          style={contentStyle}
        >
          <LyricsProvider value={{ hasYrc }}>
            {lines.map((line, i) => {
              const status =
                i < activeLine
                  ? ('past' as const)
                  : i > activeLine
                    ? ('future' as const)
                    : ('active' as const);
              return (
                <LyricLine
                  key={`${line.startMs}-${line.text.slice(0, 8)}`}
                  line={line}
                  lineIndex={i}
                  tline={tlyric[i]}
                  status={status}
                  activeWord={status === 'active' ? activeWord : -1}
                />
              );
            })}
          </LyricsProvider>
        </ul>
      </div>
    </div>
  );
};

interface LyricsContextValue {
  hasYrc: boolean;
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
    throw new Error('useLyricsContext must be used within <LyricsProvider>');
  }
  return ctx;
};
