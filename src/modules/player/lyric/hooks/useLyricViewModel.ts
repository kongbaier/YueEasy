import { useQuery } from '@tanstack/react-query';
import { fetchLyrics } from '../lyricsService';
import { usePlayerStore } from '@/stores/player';
import { useLyrics } from './useLyrics';

/**
 * lyric 域门面 hook：收敛 Lyrics / LyricLine / Word 3 个组件所需的 store/service 能力。
 * 组件只 import 本 hook，不直接触碰 store/service。
 *
 * 注意：不暴露响应式高频时间 —— 低频 activeLine 由 useLyrics 订阅 store.currentTime
 * （timeupdate 事件驱动）计算；逐字高亮由 useActiveLine 本地 rAF 直读
 * audioCore.getPosition()（仅挂在 active 行）。
 */
export function useLyricViewModel() {
  // 当前曲目读 player store（编排层权威）；seek 亦在此。
  const trackId = usePlayerStore((s) => s.currentTrack?.track_id);
  const seek = usePlayerStore((s) => s.seek);

  const { data, isLoading } = useQuery({
    queryKey: ['lyrics', trackId],
    queryFn: () =>
      trackId ? fetchLyrics(trackId) : { lyric: [], tlyric: [], yrc: [] },
    enabled: Boolean(trackId),
    staleTime: Infinity,
  });

  const { lines, activeLine, hasLyrics, hasYrc, tlyric } = useLyrics(data);

  return {
    trackId,
    seek,
    isLoading,
    lines,
    activeLine,
    hasLyrics,
    hasYrc,
    tlyric,
  };
}
