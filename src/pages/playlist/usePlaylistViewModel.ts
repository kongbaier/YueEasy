import { useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getPlaylistDetail } from '@/pages/playlist/services/PlaylistService';
import { useLoadMore } from '@/shared/hooks/useLoadMore';
import { toast } from '@/shared/lib/toast';
import type { Song } from '@/shared/types/entities';
import { playerService } from '@/modules/player/services/PlayerService';

/**
 * 歌单详情页 viewmodel：组合 React Query 取数 + playerService 命令。
 * 用 useQuery（非 suspense）：页面自身不挂起，加载态由页面早返回骨架屏承载，
 * 从而省掉「为承载 Suspense 边界而多包一层组件」。
 * throwOnError 让取数失败照旧抛给上层错误边界，与 suspense 模式行为一致。
 * `playlist` 为 undefined 即数据未就绪。
 */
export function usePlaylistViewModel(id: number) {
  const play = playerService.play;
  const replaceAndPlay = playerService.replaceAndPlay;

  const { data } = useQuery({
    queryKey: ['playlist', id],
    queryFn: () => getPlaylistDetail(Number(id)),
    throwOnError: true,
  });

  const playlist = data?.playlist;
  const visibleCount = useLoadMore(playlist?.tracks?.length ?? 0);

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
    const tracks = playlist?.tracks;
    if (!tracks?.length) return;
    try {
      await replaceAndPlay(tracks);
    } catch {
      toast.error('没有可播放的歌曲');
    }
  }, [playlist?.tracks, replaceAndPlay]);

  return useMemo(
    () => ({
      playlist,
      fromCache: data?.fromCache ?? false,
      visibleCount,
      handlePlay,
      handlePlayAll,
    }),
    [playlist, data?.fromCache, visibleCount, handlePlay, handlePlayAll],
  );
}
