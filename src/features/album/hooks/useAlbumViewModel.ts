import { useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getAlbumDetail } from '../album-service';
import { toast } from '@/shared/lib/toast';
import { reportError } from '@/shared/utils/error';
import type { Song } from '@/shared/types/uiModels';
import { playerService } from '@/features/player/services/PlayerService';

/**
 * 专辑详情页 viewmodel：组合 React Query 取数 + playerService 命令。
 * 用 useQuery（非 suspense）：页面自身不挂起，加载态由页面早返回骨架屏承载，
 * 从而省掉「为承载 Suspense 边界而多包一层 Content 组件」。
 * throwOnError 让取数失败照旧抛给上层错误边界，与 suspense 模式行为一致。
 * `album` 为 undefined 即数据未就绪。
 * 只订阅 usePlayerStore 的 play / replaceAndPlay 两个 action，避免粗粒度订阅高频字段。
 * 页面组件只 import 本 hook，不直接触碰 store / service。
 */
export function useAlbumViewModel(id: number) {
  const play = playerService.play;
  const replaceAndPlay = playerService.replaceAndPlay;

  const { data, isPending } = useQuery({
    queryKey: ['album', id],
    queryFn: () => getAlbumDetail(id),
    throwOnError: true,
  });

  const album = data?.album;
  const songs = useMemo(() => data?.songs ?? [], [data]);

  const handlePlay = useCallback(
    async (track: Song) => {
      try {
        await play(track);
      } catch (e) {
        toast.error(reportError('album.play', e, '播放失败'));
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

  return { album, tracks: songs, handlePlay, handlePlayAll, isPending };
}
