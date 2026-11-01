import { useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getArtistDetail } from '../artist-service';
import { toast } from '@/shared/lib/toast';
import { reportError } from '@/shared/utils/error';
import type { Song } from '@/shared/types/uiModels';
import { playerService } from '@/features/player/services/PlayerService';

/**
 * 歌手页 viewmodel：歌手详情（含热门歌曲）取数 + 播放命令。
 * 用 useQuery（非 suspense），加载态由页面早返回骨架屏承载。
 */
export function useArtistViewModel(id: number) {
  const play = playerService.play;
  const replaceAndPlay = playerService.replaceAndPlay;

  const { data, isPending } = useQuery({
    queryKey: ['artist', id],
    queryFn: () => getArtistDetail(id),
    throwOnError: true,
  });

  const artist = data?.artist;
  const hotSongs = useMemo(() => data?.hotSongs ?? [], [data]);

  const handlePlay = useCallback(
    async (track: Song) => {
      try {
        await play(track);
      } catch (e) {
        toast.error(reportError('artist.play', e, '播放失败'));
      }
    },
    [play],
  );

  const handlePlayAll = useCallback(async () => {
    if (!hotSongs.length) return;
    try {
      await replaceAndPlay(hotSongs);
    } catch {
      toast.error('没有可播放的歌曲');
    }
  }, [replaceAndPlay, hotSongs]);

  return useMemo(
    () => ({
      artist,
      hotSongs,
      moreSongs: data?.more ?? false,
      handlePlay,
      handlePlayAll,
      isPending,
    }),
    [artist, hotSongs, data?.more, handlePlay, handlePlayAll, isPending],
  );
}
