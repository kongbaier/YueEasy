import { useEffect, useMemo, useState } from "react";
import type { LyricLine } from "@/core/lyrics/parser";
import type { LyricsResult } from "@/services/lyrics";
import { fetchLyrics } from "@/services/lyrics";
import { usePlayerStore } from "@/stores";

interface LyricsState {
  lines: LyricLine[];
  tlines: LyricLine[];
  activeLineIndex: number;
  hasLyrics: boolean;
}

export function useLyrics(): LyricsState {
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const preciseCurrentTime = usePlayerStore((s) => s.preciseCurrentTime);
  const [cache, setCache] = useState<Record<number, LyricsResult>>({});

  const trackId = currentTrack?.id;

  useEffect(() => {
    if (!trackId) return;
    if (cache[trackId]) return;

    let cancelled = false;
    fetchLyrics(trackId).then((result) => {
      if (!cancelled) {
        setCache((prev) => ({ ...prev, [trackId]: result }));
      }
    });

    return () => {
      cancelled = true;
    };
  }, [trackId, cache]);

  const result = trackId ? cache[trackId] : null;
  const lines = result?.lyric ?? [];
  const tlines = result?.tlyric ?? [];

  const activeLineIndex = useMemo(() => {
    if (lines.length === 0) return -1;
    const ms = preciseCurrentTime * 1000;

    for (let i = lines.length - 1; i >= 0; i--) {
      if (ms >= lines[i].startMs) {
        return i;
      }
    }
    return -1;
  }, [lines, preciseCurrentTime]);

  return {
    lines,
    tlines,
    activeLineIndex,
    hasLyrics: lines.length > 0,
  };
}
