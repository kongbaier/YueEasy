import { Loader2, Music } from 'lucide-react';
import type { ReactNode } from 'react';
import { createContext, use, useCallback, useEffect } from 'react';
import { cn } from '@/shared/utils/cn';
import { LyricLine } from './LyricLine';
import { useLyricScroll } from '../hooks/useLyricScroll';
import { useLyricSeekHint } from '../hooks/useLyricSeekHint';
import { useLyricViewModel } from '../hooks/useLyricViewModel';

export const Lyrics = ({ className }: { className?: string }) => {
  const {
    trackId,
    seek,
    isPending,
    lines,
    activeLine,
    scrollTargetLine,
    hasLyrics,
    hasYrc,
    tlyric,
  } = useLyricViewModel();

  // 行「跳转」按钮的展示裁决统一在列表层：展示哪行看真实指针移动，是否展示看 idle + 是否停在按钮上
  const {
    visibleLine,
    handlePointerMove,
    handlePointerLeave,
    setButtonHovered,
    handleContentMoved,
    handleHintFocus,
    handleHintBlur,
  } = useLyricSeekHint(trackId);

  const { containerRef, contentRef, contentStyle, translateY, focusLine } =
    useLyricScroll(scrollTargetLine, hasLyrics, trackId);

  const handleLineFocus = useCallback(
    (lineIndex: number) => {
      handleHintFocus(lineIndex);
      focusLine(lineIndex);
    },
    [handleHintFocus, focusLine],
  );

  // 歌词内容一旦位移（播放自动滚动 / 滚轮），指针下的行就不是原来那行了，收起按钮
  useEffect(() => {
    handleContentMoved();
  }, [translateY, handleContentMoved]);

  if (isPending) {
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

  return (
    <div className={cn('h-full flex flex-col', className)}>
      <div
        className="relative overflow-clip flex-1 min-h-0 mb-4 px-4"
        onMouseLeave={handlePointerLeave}
        onMouseMove={handlePointerMove}
        ref={containerRef}
      >
        <ul
          className="space-y-2 font-sans"
          ref={contentRef}
          style={contentStyle}
        >
          <LyricsProvider value={{ hasYrc, seek }}>
            {lines.map((line, i) => {
              const status =
                i < activeLine ? 'past' : i > activeLine ? 'future' : 'active';
              return (
                <LyricLine
                  key={`${line.startMs}-${line.text.slice(0, 8)}`}
                  hintVisible={visibleLine === i}
                  line={line}
                  lineIndex={i}
                  onHintBlur={handleHintBlur}
                  onHintFocus={handleLineFocus}
                  onHintButtonHoverChange={setButtonHovered}
                  status={status}
                  tline={tlyric[i]}
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
  /**
   * 跳转到某句歌词（秒）。
   *
   * 由 Lyrics 从 VM 取一次后往下传，而不是每行各自调 useLyricViewModel：
   * 后者会让 useLyrics 的执行次数随歌词行数线性膨胀（N 行 = N 次 hook 体 +
   * N 份 playerStore 订阅 + N 份 query observer）。
   */
  seek: (time: number) => void;
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
