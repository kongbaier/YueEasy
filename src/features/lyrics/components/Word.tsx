import { memo } from 'react';

interface WordProps {
  text: string;
  status:
    | 'past-line'
    | 'past-word'
    | 'current-word'
    | 'future-word'
    | 'future-line';
  /** Fill ratio 0..1 for the current word; ignored otherwise. */
  progress?: number;
}

/**
 * Pure presentational word. Memoized so only the current word (whose progress
 * changes every frame) re-renders; past/future words keep stable props and skip.
 */
export const Word = memo(function Word({
  text,
  status,
  progress = 0,
}: WordProps) {
  if (status === 'past-line') {
    return <span>{text}</span>;
  }

  if (status === 'future-line' || status === 'future-word') {
    return <span className="text-muted-foreground">{text}</span>;
  }

  if (status === 'past-word') {
    return <span className="text-primary">{text}</span>;
  }

  if (status === 'current-word') {
    // 进度两端退化为普通单层，与 past/future 逐像素一致（同色、同内联渲染、同抗锯齿）
    if (progress <= 0) {
      return <span className="text-muted-foreground">{text}</span>;
    }
    if (progress >= 1) {
      return <span className="text-primary">{text}</span>;
    }

    return (
      <span
        className="bg-clip-text text-transparent inline-block"
        style={{
          backgroundImage: `linear-gradient(
            to right,
            var(--primary) 0%,
            var(--primary) ${progress * 100}%,
            var(--muted-foreground) ${progress * 100}%,
            var(--muted-foreground) 100%
          )`,
        }}
      >
        {text}
      </span>
    );
  }

  return <span className="text-muted-foreground">{text}</span>;
});
