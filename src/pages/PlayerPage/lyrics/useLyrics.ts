import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import type { LyricLine } from "@/core/lyrics/parser";
import { fetchLyrics } from "@/services/lyrics";
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
  const hasWordLyrics = yrc.length > 0;
  const lines = hasWordLyrics ? yrc : (data?.lyric ?? []);

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

  const { currentWordIndex, wordProgress } = useMemo(() => {
    if (!hasWordLyrics || index < 0) return { currentWordIndex: -1, wordProgress: 0 };
    const line = lines[index];
    if (!line?.words?.length) return { currentWordIndex: -1, wordProgress: 0 };

    const elapsed = currentTime * 1000 - line.startMs;

    for (let i = line.words.length - 1; i >= 0; i--) {
      const w = line.words[i];
      if (elapsed >= w.startMs) {
        if (elapsed <= w.startMs + w.durationMs) {
          // Within this word
          return {
            currentWordIndex: i,
            wordProgress: Math.min((elapsed - w.startMs) / w.durationMs, 1),
          };
        }
        // Past this word's end — still the last word we've reached
        return { currentWordIndex: i, wordProgress: 1 };
      }
    }
    return { currentWordIndex: -1, wordProgress: 0 };
  }, [hasWordLyrics, index, lines, currentTime]);

  return {
    lines,
    index,
    hasLyrics: lines.length > 0,
    isLoading,
    currentWordIndex,
    wordProgress,
    hasWordLyrics,
  };
}
