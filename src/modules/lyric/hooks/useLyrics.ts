import { useEffect, useRef, useState } from 'react';
import type { LyricLine } from '@/modules/lyric/parser';
import type { LyricsResult } from '@/modules/lyric/lyricsService';
import { usePlayerStore } from '@/modules/player/stores/player';

interface LyricsState {
  lines: LyricLine[];
  activeLine: number;
  hasLyrics: boolean;
  hasYrc: boolean;
  tlyric: LyricLine[];
}

/**
 * Synchronously compute active line index from the given time and lyric data.
 * Pure function — no side effects, safe for lazy state init and subscriber callbacks.
 */
function computeActiveLine(
  currentTime: number,
  lines: LyricLine[],
): number {
  if (lines.length === 0) return -1;

  const ms = currentTime * 1000;

  // Reverse scan for the last line whose start is reached
  for (let i = lines.length - 1; i >= 0; i--) {
    if (ms >= lines[i].startMs) return i;
  }

  return -1;
}

export const useLyrics = (
  lyricResult: LyricsResult | undefined,
): LyricsState => {
  const yrc = lyricResult?.yrc ?? [];
  const lyric = lyricResult?.lyric ?? [];
  const tlyric = lyricResult?.tlyric ?? [];

  const hasYrc = yrc.length > 0;
  const mainLines = hasYrc ? yrc : lyric;
  const lines = mainLines.length > 0 ? mainLines : tlyric;

  // Ref holds latest data for the Zustand subscriber without effect deps churn.
  // No deps: intentionally synced after every render to keep refs current.
  const linesRef = useRef(lines);

  useEffect(() => {
    linesRef.current = lines;
  });

  // Eagerly compute active line on mount so the scroll position is correct on first paint.
  // Lazy initializer runs once; subsequent updates come from the Zustand subscriber.
  const [activeLine, setActiveLine] = useState<number>(() =>
    computeActiveLine(usePlayerStore.getState().currentTime, lines),
  );

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
