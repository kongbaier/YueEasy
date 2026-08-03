import { useMemo } from 'react';
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
 * useLyrics（订阅 currentTime 计算 active）与 useCurrentTimeHigh（非响应式逐帧读取）
 * 各自收敛，避免 60fps 的 React 重渲染。
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

  const { lines, active, hasLyrics, hasYrc, tlyric } = useLyrics(data);

  return { trackId, seek, isLoading, lines, active, hasLyrics, hasYrc, tlyric };
}

interface TimeHighAccess {
  /** 同步读取当前高精度播放时间（秒）。 */
  read: () => number;
  /** 订阅高精度时间更新；返回取消订阅函数。 */
  subscribe: (listener: (timeHigh: number) => void) => () => void;
}

/**
 * 逐帧高精度时间（currentTimeHigh）的非响应式访问。
 * 专供 Word 逐字渐变的直接 DOM 写使用：若以响应式状态暴露，
 * 会导致整个歌词树以 60fps 重渲染，破坏现有性能设计。
 */
export function useCurrentTimeHigh(): TimeHighAccess {
  return useMemo(
    () => ({
      read: () => usePlayerStore.getState().currentTimeHigh,
      subscribe: (listener) =>
        usePlayerStore.subscribe((state) => listener(state.currentTimeHigh)),
    }),
    [],
  );
}
