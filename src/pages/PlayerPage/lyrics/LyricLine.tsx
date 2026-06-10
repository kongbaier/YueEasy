import type { KeyboardEvent } from "react";
import { useCallback } from "react";
import type { LyricLine as LyricLineType } from "@/core/lyrics/parser";
import { cn } from "@/lib/utils";
import { usePlayerStore } from "@/stores";
import { useLyricsContext } from "./Lyrics";
import { useLineLayout } from "./useLineLayout";

interface LyricLineProps {
  line: LyricLineType;
  lineIndex: number;
}

export const LyricLine = ({ line, lineIndex }: LyricLineProps) => {
  const { index, contentWidth } = useLyricsContext();
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

  return (
    <li
      className={cn(
        "transition-colors cursor-pointer",
        isPast && "",
        isActive && "text-primary",
        !isActive && !isPast && "text-muted-foreground",
      )}
      data-line={lineIndex}
      onClick={handleSeek}
      onKeyDown={handleKeyDown}
    >
      {layoutResult?.lines.map((l) => (
        <p
          className={cn(
            "text-base leading-7 transition-[scale] origin-left ease-in-out duration-300",
            isActive && "font-medium scale-110",
          )}
          key={`${l.start}-${l.end}`}
        >
          {l.text}
        </p>
      ))}
    </li>
  );
};
