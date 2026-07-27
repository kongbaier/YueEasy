import { useCallback } from "react";
import type { LyricLine as LyricLineType } from "@/features/lyric/parser";
import { cn } from "@/shared/lib/utils";
import { usePlayerStore } from "@/stores";
import { useLyricsContext } from "./Lyrics";
import { Word } from "./Word";

interface LyricLineProps {
  line: LyricLineType;
  lineIndex: number;
  currentWordIndex: number;
  wordProgress: number;
}

export const LyricLine = ({
  line,
  lineIndex,
  currentWordIndex,
  wordProgress,
}: LyricLineProps) => {
  const { index, hasWordLyrics, translatedLyric } = useLyricsContext();
  const translatedText = translatedLyric[lineIndex];
  const seek = usePlayerStore((s) => s.seek);

  const handleSeek = useCallback(() => {
    seek(line.startMs / 1000);
  }, [seek, line.startMs]);

  const showWords = hasWordLyrics && line.words?.length;

  return (
    <li
      className={cn(
        "cursor-pointer w-full group",
        !hasWordLyrics && "data-[status=active]:text-primary",
        "data-[status=future]:text-muted-foreground",
      )}
      data-line={lineIndex}
      data-status={
        lineIndex < index ? "past" : lineIndex === index ? "active" : "future"
      }
      onClick={handleSeek}
    >
      <p
        className={cn(
          "text-base lg:text-lg leading-loose w-4/5 transition-[scale] origin-left ease-in-out duration-300",
          "group-data-[status=active]:scale-110",
        )}
      >
        {showWords
          ? line.words?.map((w, wordIndex) => (
              <Word
                activeLineIndex={index}
                currentWordIndex={currentWordIndex}
                // oxlint-disable-next-line react/no-array-index-key 歌词的index不会随便改变
                key={wordIndex}
                lineIndex={lineIndex}
                text={w.text}
                wordIndex={wordIndex}
                wordProgress={wordProgress}
              />
            ))
          : line.text}
      </p>
      {translatedText && <TranslatedText text={translatedText} />}
    </li>
  );
};

const TranslatedText = ({ text }: { text: string }) => (
  <p
    className={cn(
      "text-xs leading-5 transition-colors",
      "group-data-[status=active]:text-muted-foreground/80",
      "group-data-[status=past]:text-muted-foreground/50",
      "group-data-[status=future]:text-muted-foreground/40",
    )}
  >
    {text}
  </p>
);
