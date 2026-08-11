import { useQuery } from '@tanstack/react-query';
import { fetchLyrics } from '../lyricsService';
import { useQueueStore } from '@/modules/player/stores/queue';
import { usePlayerStore } from '@/modules/player/stores/player';
import { useLyrics } from './useLyrics';

/**
 * lyric 域门面 hook：收敛 Lyrics / LyricLine / Word 3 个组件所需的 store/service 能力。
 * 组件只 import 本 hook，不直接触碰 store/service。
 *
 * 注意：不暴露响应式 currentTime / currentTimeHigh —— 高频时间由
 * useLyrics（低频订阅 currentTime 计算 activeLine）与 useActiveLine
 * （60fps 响应式订阅 currentTimeHigh，仅挂在 active 行）各自收敛。
 */
export function useLyricViewModel() {
  const trackId = useQueueStore((s) => s.currentTrack?.id);
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
