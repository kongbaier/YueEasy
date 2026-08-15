import { useCallback, useMemo } from 'react';
import { useSuspenseQuery } from '@tanstack/react-query';
import { getAlbumDetail } from './AlbumService';
import { useLoadMore } from '@/shared/hooks/useLoadMore';
import { toast } from '@/shared/lib/toast';
import type { Song } from '@/shared/types/entities';
import { usePlayerStore } from '@/stores/player';

/**
 * 专辑详情页 viewmodel：组合 React Query 取数 + queue store 动作。
 * 只订阅 usePlayerStore 的 play / replaceAndPlay 两个 action，避免粗粒度订阅高频字段。
 * 页面组件只 import 本 hook，不直接触碰 store / service。
 */
export function useAlbumViewModel(id: number) {
  const play = usePlayerStore((s) => s.play);
  const replaceAndPlay = usePlayerStore((s) => s.replaceAndPlay);

  const { data } = useSuspenseQuery({
    queryKey: ['album', id],
    queryFn: () => getAlbumDetail(id),
  });

  const { album, songs } = data;
  const visibleCount = useLoadMore(songs.length);

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
    if (!songs.length) return;
    try {
      await replaceAndPlay(songs);
    } catch {
      toast.error('没有可播放的歌曲');
    }
  }, [replaceAndPlay, songs]);

  return useMemo(
    () => ({ album, tracks: songs, visibleCount, handlePlay, handlePlayAll }),
    [album, songs, visibleCount, handlePlay, handlePlayAll],
  );
}
