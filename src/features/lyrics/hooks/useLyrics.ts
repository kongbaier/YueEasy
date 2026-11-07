import { useEffect, useRef, useState } from 'react';
import type { LyricLine } from '@/features/lyrics/parser';
import type { LyricsResult } from '@/features/lyrics/lyrics-service';
import { usePlayerStore } from '@/features/player/stores/playerStore';
import { computeActiveLine } from '@/features/lyrics/active-line';
import { resolveLyricLines } from '@/features/lyrics/lines';

interface LyricsState {
  lines: LyricLine[];
  activeLine: number;
  hasLyrics: boolean;
  hasYrc: boolean;
  tlyric: LyricLine[];
}

export const useLyrics = (
  lyricResult: LyricsResult | undefined,
): LyricsState => {
  const { lines, hasYrc } = resolveLyricLines(lyricResult);
  const tlyric = lyricResult?.tlyric ?? [];

  const linesRef = useRef(lines);

  useEffect(() => {
    linesRef.current = lines;
  });

  const [activeLine, setActiveLine] = useState<number>(() =>
    computeActiveLine(usePlayerStore.getState().currentTime, lines),
  );

  useEffect(() => {
    setActiveLine(
      computeActiveLine(
        usePlayerStore.getState().currentTime,
        linesRef.current,
      ),
    );
  }, [lyricResult]);

  // Subscribe to currentTime via Zustand — only setState when the line index changes.
  useEffect(() => {
    let prevLine = activeLine;
    let prevTime = -1;

    const unsub = usePlayerStore.subscribe((state) => {
      const { currentTime } = state;
      if (currentTime === prevTime) return;
      prevTime = currentTime;

      const lineIndex = computeActiveLine(currentTime, linesRef.current);

      if (lineIndex !== prevLine) {
        prevLine = lineIndex;
        setActiveLine(lineIndex);
      }
    });

    return unsub;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    lines,
    activeLine,
    hasLyrics: lines.length > 0,
    hasYrc,
    tlyric,
  };
};
