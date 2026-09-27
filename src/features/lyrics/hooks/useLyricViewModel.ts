import { useMemo } from 'react';
import { skipToken, useQuery } from '@tanstack/react-query';
import { fetchLyrics } from '../lyrics-service';
import { computeScrollTargetLine } from '../scroll-target';
import { usePlayerStore } from '@/features/player/stores/playerStore';
import { playerService } from '@/features/player/services/PlayerService';
import { useLyrics } from './useLyrics';

export function useLyricViewModel() {
  // 当前曲目读 player store（编排层权威）；seek 亦在此。
  const trackId = usePlayerStore((s) => s.currentTrack?.track_id);
  const seek = playerService.seek;

  const { data, isPending } = useQuery({
    queryKey: ['lyrics', trackId],
    queryFn: trackId ? () => fetchLyrics(trackId) : skipToken,
    staleTime: Infinity,
  });

  const { lines, activeLine, hasLyrics, hasYrc, tlyric } = useLyrics(data);

  // 高亮行 → 视口目标行（跳空行、前奏落到第一句）：视口该停在哪句 ≠ 哪句在唱
  const scrollTargetLine = useMemo(
    () => computeScrollTargetLine(activeLine, lines),
    [activeLine, lines],
  );

  return {
    trackId,
    seek,
    isPending,
    lines,
    activeLine,
    scrollTargetLine,
    hasLyrics,
    hasYrc,
    tlyric,
  };
}
