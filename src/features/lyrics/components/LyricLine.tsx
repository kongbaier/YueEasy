import { PlayCircle } from 'lucide-react';
import { useCallback } from 'react';
import type { LyricLine as LyricLineType } from '@/features/lyrics/parser';
import { cn } from '@/shared/utils/cn';
import { useLyricsContext } from './Lyrics';
import { Word } from './Word';
import { useLyricViewModel } from '../hooks/useLyricViewModel';
import { useActiveLine } from '../hooks/useActiveLine';
import { Button } from '@/shared/ui/button';
import { formatTime } from '@/shared/utils/format';

interface LyricLineProps {
  line: LyricLineType;
  tline?: LyricLineType;
  lineIndex: number;
  status: 'past' | 'active' | 'future';
  /** 是否展示该行的「跳转」按钮：由 Lyrics 统一裁决（展示哪行 + 是否展示） */
  hintVisible: boolean;
  /** 指针进出「跳转」按钮：停在按钮上期间不参与 idle 收起判定 */
  onHintButtonHoverChange: (hovered: boolean) => void;
}

export const LyricLine = ({
  line,
  tline,
  lineIndex,
  status,
  hintVisible,
  onHintButtonHoverChange,
}: LyricLineProps) => {
  const { hasYrc } = useLyricsContext();
  const { seek } = useLyricViewModel();

  const handleSeek = useCallback(() => {
    seek(line.startMs / 1000);
  }, [seek, line.startMs]);

  // 行级 hover 一律不做：内容滚动也会触发合成 mouseenter/mousemove，
  // “展示哪行”统一由列表容器上的真实指针移动判定（见 useLyricSeekHint）。
  // 停在按钮上 → 暂停自动收起，按钮一直可点（否则「正要点击时按钮从脚下消失」最糟）；
  // 移开按钮后由列表层重新计时。
  const handleSeekButtonEnter = useCallback(() => {
    onHintButtonHoverChange(true);
  }, [onHintButtonHoverChange]);

  const handleSeekButtonLeave = useCallback(() => {
    onHintButtonHoverChange(false);
  }, [onHintButtonHoverChange]);

  return (
    <li
      className={cn(
        'relative w-full group',
        !hasYrc && 'data-[status=active]:text-primary',
        'data-[status=future]:text-muted-foreground',
      )}
      data-line={lineIndex}
      data-status={status}
    >
      <p
        className={cn(
          'font-medium text-base lg:text-lg leading-loose w-4/5 transition-[scale] origin-left ease-in-out duration-300',
          'group-data-[status=active]:scale-110',
        )}
      >
        {hasYrc && status === 'active' ? (
          <ActiveLineContent line={line} />
        ) : (
          line.text
        )}
      </p>
      {tline && <TranslatedText text={tline.text} />}
      <Button
        aria-label="跳转到这句歌词"
        className={cn(
          'absolute block right-0 top-1/2 -translate-y-1/2 rounded-md',
          'text-xs text-muted-foreground',
          'flex items-center',
          'rounded-full px-2 py-1 h-auto',
          'hover:text-primary focus-visible:opacity-100 focus-visible:pointer-events-auto',
          hintVisible ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
        onClick={handleSeek}
        onMouseEnter={handleSeekButtonEnter}
        onMouseLeave={handleSeekButtonLeave}
        title="跳转到这句歌词"
        variant={'outline'}
        type="button"
      >
        <PlayCircle className="size-3.5" />
        {formatTime(line.startMs)}
      </Button>
    </li>
  );
};
/**
 * Words of the active line. useActiveLine rAF-samples audioCore.getPosition() at 60fps
 * and re-renders every frame; memoized Word children mean only the current word
 * actually re-renders (its progress prop changes), the rest skip.
 */
const ActiveLineContent = ({ line }: { line: LyricLineType }) => {
  const { wordIndex, progress } = useActiveLine(line);
  const words = line.words ?? [];

  return (
    <>
      {words.map((w, i) => {
        const wordStatus =
          i < wordIndex
            ? 'past-word'
            : i === wordIndex
              ? 'current-word'
              : 'future-word';
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
