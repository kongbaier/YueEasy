interface WordProps {
  text: string;
  lineIndex: number;
  wordIndex: number;
  activeLineIndex: number;
  currentWordIndex: number;
  wordProgress: number;
}

export const Word = ({
  text,
  lineIndex,
  wordIndex,
  activeLineIndex,
  currentWordIndex,
  wordProgress,
}: WordProps) => {
  const isPastLine = lineIndex < activeLineIndex;
  const isFutureLine = lineIndex > activeLineIndex;
  const isActiveLine = lineIndex === activeLineIndex;

  const isPastWord = isActiveLine && wordIndex < currentWordIndex;
  const isCurrentWord = isActiveLine && wordIndex === currentWordIndex;
  const isFutureWord = isActiveLine && wordIndex > currentWordIndex;

  if (isPastLine) {
    return <span>{text}</span>;
  }

  if (isFutureLine || isFutureWord) {
    return <span className="text-muted-foreground">{text}</span>;
  }

  if (isPastWord) {
    return <span className="text-primary">{text}</span>;
  }

  if (isCurrentWord) {
    return (
      <span
        className="bg-clip-text text-transparent"
        style={
          {
            backgroundImage: `linear-gradient(to right, var(--primary) 0%, var(--primary) ${wordProgress * 100}%, var(--muted-foreground) ${wordProgress * 100}%)`,
            WebkitBackgroundClip: "text",
          } as React.CSSProperties
        }
      >
        {text}
      </span>
    );
  }

  return <span className="text-muted-foreground">{text}</span>;
};
