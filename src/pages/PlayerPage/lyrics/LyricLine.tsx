import type { KeyboardEvent } from "react";
import { useCallback } from "react";
import type { LyricLine as LyricLineType } from "@/core/lyrics/parser";
import { cn } from "@/lib/utils";
import { usePlayerStore } from "@/stores";
import { useLyricsContext } from "./Lyrics";
import { useLineLayout } from "./useLineLayout";
import { Word } from "./Word";

interface LyricLineProps {
  line: LyricLineType;
  lineIndex: number;
}

export const LyricLine = ({ line, lineIndex }: LyricLineProps) => {
  const {
    index,
    contentWidth,
    currentWordIndex,
    wordProgress,
    hasWordLyrics,
    translatedLyric,
  } = useLyricsContext();
  const translatedText = translatedLyric[lineIndex];
  const isActive = lineIndex === index;
  const isPast = lineIndex < index;
  const layoutResult = useLineLayout(line.text, contentWidth);
  const seek = usePlayerStore((s) => s.seek);

  const handleSeek = useCallback(() => {
    seek(line.startMs / 1000);
  }, [seek, line.startMs]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLLIElement>) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        seek(line.startMs / 1000);
      }
    },
    [seek, line.startMs],
  );

  const showWords = hasWordLyrics && line.words?.length;

  return (
    <li
      className={cn(
        "transition-colors cursor-pointer",
        isActive && !hasWordLyrics && "text-primary",
        !isActive && !isPast && "text-muted-foreground",
      )}
      data-line={lineIndex}
      onClick={handleSeek}
      onKeyDown={handleKeyDown}
    >
      {showWords ? (
        <p
          className={cn(
            "text-base leading-7 transition-[scale] origin-left ease-in-out duration-300",
            isActive && "font-medium scale-110",
          )}
        >
          {line.words!.map((w, wi) => (
            <Word
              activeLineIndex={index}
              currentWordIndex={currentWordIndex}
              key={wi}
              lineIndex={lineIndex}
              text={w.text}
              wordIndex={wi}
              wordProgress={wordProgress}
            />
          ))}
        </p>
      ) : (
        layoutResult?.lines.map((l) => (
          <p
            className={cn(
              "text-base leading-7 transition-[scale] origin-left ease-in-out duration-300",
              isActive && "font-medium scale-110",
            )}
            key={`${l.start.segmentIndex}-${l.start.graphemeIndex}-${l.end.segmentIndex}-${l.end.graphemeIndex}`}
          >
            {l.text}
          </p>
        ))
      )}
      {translatedText && (
        <p
          className={cn(
            "text-xs leading-5 transition-colors",
            isActive && "text-muted-foreground/80",
            isPast && "text-muted-foreground/50",
            !isActive && !isPast && "text-muted-foreground/40",
          )}
        >
          {translatedText}
        </p>
      )}
    </li>
  );
};
