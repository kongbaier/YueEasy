import { memo, useCallback } from 'react';
import type { LyricLine as LyricLineType } from '@/modules/player/lyric/parser';
import { cn } from '@/shared/utils/cn';
import { useLyricsContext } from './Lyrics';
import { Word } from './Word';
import { useLyricViewModel } from '../hooks/useLyricViewModel';
import { useActiveLine } from '../hooks/useActiveLine';

interface LyricLineProps {
  line: LyricLineType;
  tline?: LyricLineType;
  lineIndex: number;
  status: 'past' | 'active' | 'future';
}

export const LyricLine = memo(function LyricLine({
  line,
  tline,
  lineIndex,
  status,
}: LyricLineProps) {
  const { hasYrc } = useLyricsContext();
  const { seek } = useLyricViewModel();

  const handleSeek = useCallback(() => {
    seek(line.startMs / 1000);
  }, [seek, line.startMs]);

  const showWords = hasYrc && line.words?.length;

  return (
    <li
      className={cn(
        'cursor-pointer w-full group',
        !hasYrc && 'data-[status=active]:text-primary',
        'data-[status=future]:text-muted-foreground',
      )}
      data-line={lineIndex}
      data-status={status}
      onClick={handleSeek}
    >
      <p
        className={cn(
          'text-base lg:text-lg leading-loose w-4/5 transition-[scale] origin-left ease-in-out duration-300',
          'group-data-[status=active]:scale-110',
        )}
      >
        {showWords ? (
          status === 'active' ? (
            <ActiveLineContent line={line} />
          ) : (
            line.words?.map((w, wordIndex) => {
              const wordStatus =
                status === 'past'
                  ? ('past-line' as const)
                  : ('future-line' as const);
              return (
                <Word
                  // oxlint-disable-next-line react/no-array-index-key 歌词的index不会随便改变
                  key={wordIndex}
                  text={w.text}
                  status={wordStatus}
                />
              );
            })
          )
        ) : (
          line.text
        )}
      </p>
      {tline && <TranslatedText text={tline.text} />}
    </li>
  );
});

/**
 * Words of the active line. Subscribes to currentTimeHigh (60fps) via useActiveLine
 * and re-renders every frame; memoized Word children mean only the current word
 * actually re-renders (its progress prop changes), the rest skip.
 */
const ActiveLineContent = ({ line }: { line: LyricLineType }) => {
  const { wordIndex, progress } = useActiveLine(line);
  const words = line.words ?? [];

  if (words.length === 0) return <>{line.text}</>;

  return (
    <>
      {words.map((w, i) => {
        const wordStatus =
          i < wordIndex
            ? ('past-word' as const)
            : i === wordIndex
              ? ('current-word' as const)
              : ('future-word' as const);
        return (
          <Word
            // oxlint-disable-next-line react/no-array-index-key 歌词的index不会随便改变
            key={i}
            text={w.text}
            status={wordStatus}
            progress={wordStatus === 'current-word' ? progress : 0}
          />
        );
      })}
    </>
  );
};

const TranslatedText = ({ text }: { text: string }) => (
  <p
    className={cn(
      'text-xs leading-5 transition-colors',
      'group-data-[status=active]:text-muted-foreground/80',
      'group-data-[status=past]:text-muted-foreground/50',
      'group-data-[status=future]:text-muted-foreground/40',
    )}
  >
    {text}
  </p>
);
