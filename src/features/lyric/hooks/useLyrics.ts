import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import type { LyricLine } from "@/features/lyric/parser";
import { fetchLyrics } from "@/features/lyric/lyrics-service";
import { usePlayerStore } from "@/stores";

interface LyricsState {
  lines: LyricLine[];
  index: number;
  hasLyrics: boolean;
  isLoading: boolean;
  /** Current word index within the active line (-1 if none) */
  currentWordIndex: number;
  /** 0–1 progress within the current word */
  wordProgress: number;
  /** Whether word-level (逐字) lyrics are available */
  hasWordLyrics: boolean;
  /** Translated lyric texts, index-aligned with lines */
  translatedLyric: string[];
}

export function useLyrics(): LyricsState {
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const currentTime = usePlayerStore((s) => s.currentTime);
  const trackId = currentTrack?.id;

  const { data, isLoading } = useQuery({
    queryKey: ["lyrics", trackId],
    queryFn: () => {
      if (!trackId) return { lyric: [], tlyric: [], yrc: [] };
      return fetchLyrics(trackId);
    },
    enabled: !!trackId,
    staleTime: Infinity,
  });

  const yrc = data?.yrc ?? [];
  const rawLyric = data?.lyric ?? [];
  const tlines = data?.tlyric ?? [];

  const hasWordLyrics = yrc.length > 0;
  const mainLines = hasWordLyrics ? yrc : rawLyric;
  const lines = mainLines.length > 0 ? mainLines : tlines;
  const translatedLyric = mainLines.length > 0 ? tlines.map((l) => l.text) : [];

  const index = useMemo(() => {
    if (lines.length === 0) return -1;
    const ms = currentTime * 1000;

    for (let i = lines.length - 1; i >= 0; i--) {
      if (ms >= lines[i].startMs) {
        return i;
      }
    }
    return -1;
  }, [lines, currentTime]);

  const line = lines[index];

  const [currentWordIndex, wordProgress] = useMemo(() => {
    if (!hasWordLyrics || !line?.words?.length) {
      return [-1, 0] as const;
    }

    const elapsed = currentTime * 1000 - line.startMs;
    const words = line.words;

    for (let i = words.length - 1; i >= 0; i--) {
      const word = words[i];
      if (elapsed < word.startMs) continue;

      const wordEnd = word.startMs + word.durationMs;

      if (elapsed <= wordEnd) {
        return [
          i,
          Math.min((elapsed - word.startMs) / word.durationMs, 1),
        ] as const;
      }

      return [i, 1] as const;
    }

    return [-1, 0] as const;
  }, [hasWordLyrics, line, currentTime]);

  return {
    lines,
    index,
    hasLyrics: lines.length > 0,
    isLoading,
    currentWordIndex,
    wordProgress,
    hasWordLyrics,
    translatedLyric,
  };
}
