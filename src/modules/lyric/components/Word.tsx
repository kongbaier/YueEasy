import { usePlayerStore } from "@/modules/player/stores/player";
import { useEffect, useLayoutEffect, useRef } from "react";

interface WordProps {
  text: string;
  status:
    "past-line" | "past-word" | "current-word" | "future-word" | "future-line";
  absoluteStartMs: number;
  durationMs: number;
}

/**
 * Current word — gradient animation driven by direct DOM write via Zustand subscribe.
 * Bypasses React rendering entirely for the per-frame gradient update (~60fps).
 *
 * useLayoutEffect sets the initial gradient before first paint to avoid a flash
 * of invisible text. The useEffect subscriber takes over for subsequent frames.
 */
const CurrentWord = ({
  text,
  absoluteStartMs,
  durationMs,
}: {
  text: string;
  absoluteStartMs: number;
  durationMs: number;
}) => {
  const spanRef = useRef<HTMLSpanElement>(null);

  // Set initial gradient before first paint — avoids flash
  useLayoutEffect(() => {
    const el = spanRef.current;
    if (!el) return;

    const currentTimeHigh = usePlayerStore.getState().currentTimeHigh;
    const elapsed = currentTimeHigh * 1000 - absoluteStartMs;
    const progress = Math.min(Math.max(elapsed / durationMs, 0), 1);
    el.style.backgroundImage = `linear-gradient(to right, var(--primary) ${progress * 100}%, var(--muted-foreground) ${progress * 100}%)`;
  }, [absoluteStartMs, durationMs]);

  // Continue updating every frame via Zustand subscribe (zero React overhead)
  useEffect(() => {
    const el = spanRef.current;
    if (!el) return;

    let prevTime = -1;

    const unsub = usePlayerStore.subscribe((state) => {
      const { currentTimeHigh } = state;
      if (currentTimeHigh === prevTime) return;
      prevTime = currentTimeHigh;

      const elapsed = currentTimeHigh * 1000 - absoluteStartMs;
      const progress = Math.min(Math.max(elapsed / durationMs, 0), 1);
      el.style.backgroundImage = `linear-gradient(to right, var(--primary) ${progress * 100}%, var(--muted-foreground) ${progress * 100}%)`;
    });

    return unsub;
  }, [absoluteStartMs, durationMs]);

  return (
    <span ref={spanRef} className="bg-clip-text text-transparent">
      {text}
    </span>
  );
};

export const Word = ({
  text,
  status,
  absoluteStartMs,
  durationMs,
}: WordProps) => {
  if (status === "past-line") {
    return <span>{text}</span>;
  }

  if (status === "future-line" || status === "future-word") {
    return <span className="text-muted-foreground">{text}</span>;
  }

  if (status === "past-word") {
    return <span className="text-primary">{text}</span>;
  }

  if (status === "current-word") {
    return (
      <CurrentWord
        text={text}
        absoluteStartMs={absoluteStartMs}
        durationMs={durationMs}
      />
    );
  }

  return <span className="text-muted-foreground">{text}</span>;
};
