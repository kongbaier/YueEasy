interface WordProps {
  text: string;
  status: 'past-word' | 'current-word' | 'future-word';
  /** Fill ratio 0..1 for the current word; ignored otherwise. */
  progress?: number;
}

/**
 * 逐字歌词的字组件
 * @param param0
 * @returns
 */
export const Word = ({ text, status, progress = 0 }: WordProps) => {
  if (status === 'future-word') {
    return <span className="text-muted-foreground">{text}</span>;
  }

  if (status === 'past-word') {
    return <span className="text-primary">{text}</span>;
  }

  return (
    <span
      className="bg-clip-text text-transparent"
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
};
