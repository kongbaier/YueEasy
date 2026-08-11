import { useCallback, useMemo } from 'react';
import { useSuspenseQuery } from '@tanstack/react-query';
import { getPlaylistDetail } from '@/modules/playlist/services/PlaylistService';
import { useLoadMore } from '@/shared/hooks/useLoadMore';
import { toast } from '@/shared/lib/toast';
import type { Song } from '@/shared/types/entities';
import { useQueueStore } from '@/modules/player/stores/queue';

/**
 * 歌单详情页 viewmodel：组合 React Query 取数 + queue store 动作。
 * 只订阅 useQueueStore 的 play / replaceAndPlay 两个 action，避免粗粒度订阅高频字段。
 * 页面组件只 import 本 hook，不直接触碰 store / service。
 */
export function usePlaylistViewModel(id: number) {
  const play = useQueueStore((s) => s.play);
  const replaceAndPlay = useQueueStore((s) => s.replaceAndPlay);

  const { data } = useSuspenseQuery({
    queryKey: ['playlist', id],
    queryFn: () => getPlaylistDetail(Number(id)),
  });

  const { playlist, fromCache } = data;
  const visibleCount = useLoadMore(playlist.tracks?.length ?? 0);

  const handlePlay = useCallback(
    async (track: Song) => {
      try {
        await play(track);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : '播放失败');
      }
    },
    [play],
  );

  const handlePlayAll = useCallback(async () => {
    const tracks = playlist.tracks;
    if (!tracks?.length) return;
    try {
      await replaceAndPlay(tracks);
    } catch {
      toast.error('没有可播放的歌曲');
    }
  }, [playlist.tracks, replaceAndPlay]);

  return useMemo(
    () => ({ playlist, fromCache, visibleCount, handlePlay, handlePlayAll }),
    [playlist, fromCache, visibleCount, handlePlay, handlePlayAll],
  );
}