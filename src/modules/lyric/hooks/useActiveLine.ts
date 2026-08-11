import type { LyricLine } from '@/modules/lyric/parser';
import { usePlayerStore } from '@/modules/player/stores/player';

/**
 * Per-frame word state for the ACTIVE lyric line only.
 *
 * Subscribes reactively to currentTimeHigh (the ~60fps rAF-backed store value).
 * This is the single high-frequency React subscription point in the lyric tree —
 * it lives only inside the active line, so non-active lines and non-current words
 * stay out of the per-frame render path (they are memoized and skip).
 *
 * wordIndex and progress are derived from the SAME time source, so there is no
 * boundary mismatch between "which word is current" and its fill ratio.
 */
export function useActiveLine(line: LyricLine): {
  wordIndex: number;
  progress: number;
} {
  const currentTimeHigh = usePlayerStore((s) => s.currentTimeHigh);

  const words = line.words ?? [];
  const elapsed = currentTimeHigh * 1000 - line.startMs;

  let wordIndex = -1;
  let progress = 0;

  // Reverse scan for the last word whose start is reached.
  for (let i = words.length - 1; i >= 0; i--) {
    const word = words[i];
    if (elapsed < word.startMs) continue;
    wordIndex = i;
    progress = Math.min(
      Math.max((elapsed - word.startMs) / word.durationMs, 0),
      1,
    );
    break;
  }

  return { wordIndex, progress };
}
