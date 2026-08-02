import { useEffect, useRef, useState } from "react";
import type { LyricLine } from "@/modules/lyric/parser";
import type { LyricsResult } from "@/modules/lyric/lyricsService";
import { usePlayerStore } from "@/modules/player/stores/player";

interface LyricsState {
  lines: LyricLine[];
  active: readonly [number, number];
  hasLyrics: boolean;
  hasYrc: boolean;
  tlyric: LyricLine[];
}

/**
 * Synchronously compute [lineIndex, wordIndex] from the given time and lyric data.
 * Pure function — no side effects, safe for lazy state init and subscriber callbacks.
 */
function computeActive(
  currentTime: number,
  lines: LyricLine[],
  hasYrc: boolean,
): readonly [number, number] {
  if (lines.length === 0) return [-1, -1];

  const ms = currentTime * 1000;

  // Find active line (reverse scan)
  let lineIndex = -1;
  for (let i = lines.length - 1; i >= 0; i--) {
    if (ms >= lines[i].startMs) {
      lineIndex = i;
      break;
    }
  }

  // Find active word (YRC only)
  let wordIndex = -1;
  if (hasYrc && lineIndex >= 0) {
    const line = lines[lineIndex];
    if (line.words?.length) {
      const elapsed = ms - line.startMs;
      for (let i = line.words.length - 1; i >= 0; i--) {
        const word = line.words[i];
        if (elapsed < word.startMs) continue;
        const wordEnd = word.startMs + word.durationMs;
        if (elapsed <= wordEnd) {
          wordIndex = i;
          break;
        }
        wordIndex = i;
        break;
      }
    }
  }

  return [lineIndex, wordIndex];
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

  // Refs hold latest data for the Zustand subscriber without effect deps churn
  const linesRef = useRef(lines);
  const hasYrcRef = useRef(hasYrc);

  // Sync refs after render so subscriber always reads the latest lyrics data.
  // No deps: intentionally runs after every render to keep refs current.
  useEffect(() => {
    linesRef.current = lines;
    hasYrcRef.current = hasYrc;
  });

  // Eagerly compute active on mount so the scroll position is correct on first paint.
  // Lazy initializer runs once; subsequent updates come from the Zustand subscriber.
  const [active, setActive] = useState<readonly [number, number]>(() =>
    computeActive(usePlayerStore.getState().currentTime, lines, hasYrc),
  );

  // Subscribe to currentTime via Zustand — only setState when line or word index changes.
  useEffect(() => {
    let prevLine = active[0];
    let prevWord = active[1];
    let prevTime = -1;

    const unsub = usePlayerStore.subscribe((state) => {
      const { currentTime } = state;
      if (currentTime === prevTime) return;
      prevTime = currentTime;

      const [lineIndex, wordIndex] = computeActive(
        currentTime,
        linesRef.current,
        hasYrcRef.current,
      );

      if (lineIndex !== prevLine || wordIndex !== prevWord) {
        prevLine = lineIndex;
        prevWord = wordIndex;
        setActive([lineIndex, wordIndex]);
      }
    });

    return unsub;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    lines,
    active,
    hasLyrics: lines.length > 0,
    hasYrc,
    tlyric,
  };
};
