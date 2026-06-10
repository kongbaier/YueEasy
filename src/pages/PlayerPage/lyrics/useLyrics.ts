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
}

export function useLyrics(): LyricsState {
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const currentTime = usePlayerStore((s) => s.currentTime);
  const trackId = currentTrack?.id;

  const { data, isLoading } = useQuery({
    queryKey: ["lyrics", trackId],
    queryFn: () => {
      if (!trackId) return { lyric: [], tlyric: [] };
      return fetchLyrics(trackId);
    },
    enabled: !!trackId,
    staleTime: Infinity,
  });

  const lines = data?.lyric ?? [];

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

  return {
    lines,
    index,
    hasLyrics: lines.length > 0,
    isLoading,
  };
}
