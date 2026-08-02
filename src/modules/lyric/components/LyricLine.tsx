import { useCallback } from 'react';
import type { LyricLine as LyricLineType } from '@/modules/lyric/parser';
import { cn } from '@/shared/lib/utils';
import { useLyricsContext } from './Lyrics';
import { Word } from './Word';
import { usePlayerStore } from '@/modules/player/stores/player';

interface LyricLineProps {
  line: LyricLineType;
  tline?: LyricLineType;
  lineIndex: number;
  status: 'past' | 'active' | 'future';
  activeWord: number;
}

export const LyricLine = ({
  line,
  tline,
  lineIndex,
  status,
  activeWord,
}: LyricLineProps) => {
  const { hasYrc } = useLyricsContext();
  const seek = usePlayerStore((s) => s.seek);

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
        {showWords
          ? line.words?.map((w, wordIndex) => {
              const wordStatus =
                status !== 'active'
                  ? status === 'past'
                    ? ('past-line' as const)
                    : ('future-line' as const)
                  : wordIndex < activeWord
                    ? ('past-word' as const)
                    : wordIndex === activeWord
                      ? ('current-word' as const)
                      : ('future-word' as const);
              return (
                <Word
                  // oxlint-disable-next-line react/no-array-index-key 歌词的index不会随便改变
                  key={wordIndex}
                  text={w.text}
                  status={wordStatus}
                  absoluteStartMs={line.startMs + w.startMs}
                  durationMs={w.durationMs}
                />
              );
            })
          : line.text}
      </p>
      {tline && <TranslatedText text={tline.text} />}
    </li>
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
