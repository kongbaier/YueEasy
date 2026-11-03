import { PlayCircle } from 'lucide-react';
import { useCallback } from 'react';
import type { FocusEvent as ReactFocusEvent } from 'react';
import type { LyricLine as LyricLineType } from '@/features/lyrics/parser';
import { cn } from '@/shared/utils/cn';
import { useLyricsContext } from './Lyrics';
import { Word } from './Word';
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
  /** 获得可见焦点：歌词列表以该行为滚动跟随目标 */
  onHintFocus: (lineIndex: number) => void;
  /** 失焦：跟随目标交还给播放行 */
  onHintBlur: () => void;
}

export const LyricLine = ({
  line,
  tline,
  lineIndex,
  status,
  hintVisible,
  onHintFocus,
  onHintBlur,
}: LyricLineProps) => {
  const { hasYrc, seek } = useLyricsContext();

  const handleSeek = useCallback(() => {
    seek(line.startMs / 1000);
  }, [seek, line.startMs]);

  const timeLabel = formatTime(line.startMs);

  // 行级 hover 一律不做：内容滚动也会触发合成 mouseenter/mousemove，
  // “展示哪行”统一由列表容器上的真实指针移动判定（见 useLyricSeekHint）。
  // 显形规则即 hover 语义：指针在该行上就显形，离开列表或内容位移才收起（无计时器）。

  // 只有「可见焦点」（Tab / 焦点环可见）才参与跟随：鼠标点击也会让按钮拿到焦点，
  // 但那不该把视图钉在这一行 —— 否则点一次跳转后歌词就再也不跟播放走了。
  const handleSeekButtonFocus = useCallback(
    (event: ReactFocusEvent<HTMLButtonElement>) => {
      if (!event.currentTarget.matches(':focus-visible')) return;
      onHintFocus(lineIndex);
    },
    [onHintFocus, lineIndex],
  );

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
      {/* 提示按钮：贴第一行（有翻译时不再落到两行交界上）；隐藏态必须 pointer-events-none，
          否则透明度为 0 的整块仍是可点热区。键盘焦点由 focus-visible:opacity-100 单独放开。 */}
      <Button
        aria-label={`跳转到这句歌词（${timeLabel}）`}
        className={cn(
          'absolute right-0 top-0 gap-1 px-2 py-1 h-auto',
          'tabular-nums text-xs text-muted-foreground',
          'hover:bg-transparent hover:text-primary',
          'focus-visible:opacity-100 focus-visible:pointer-events-auto',
          hintVisible ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
        onBlur={onHintBlur}
        onClick={handleSeek}
        onFocus={handleSeekButtonFocus}
        type="button"
        variant="ghost"
      >
        <PlayCircle className="size-3.5" />
        {timeLabel}
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
