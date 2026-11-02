import { useCallback, useMemo } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { getCloudFiles } from '../cloud-service';
import { CLOUD_PAGE_SIZE, type CloudTrack } from '../constants';
import type { Song } from '@/shared/types/uiModels';
import { toast } from '@/shared/lib/toast';
import { reportError } from '@/shared/utils/error';
import { playerService } from '@/features/player/services/PlayerService';

/**
 * 音乐云盘 viewmodel：分页取数 + 播放命令。
 *
 * 取数用非 Suspense 的 `useQuery`（与 recent / artist 一致）：加载态与登录门禁都由页面
 * early return 承载。`userId` 为空（未登录）时 `enabled` 关闭，不发请求。
 * 「加载更多」通过放大 `limit` 重取（queryKey 带 limit），`keepPreviousData` 让旧列表留在屏幕上。
 *
 * 上传后未匹配到曲库的文件只有文件名、没有 `song`，因此：
 * - `tracks`：已匹配（可播放）的文件，按上传时间倒序 —— 列表与「播放全部」都用它
 * - `unmatched`：未匹配数量，仅在计数提示里出现
 */
export function useCloudViewModel(
  userId: number | null,
  limit = CLOUD_PAGE_SIZE,
) {
  const play = playerService.play;
  const replaceAndPlay = playerService.replaceAndPlay;

  const { data, isPending, isPlaceholderData } = useQuery({
    queryKey: ['cloudFiles', userId, limit],
    queryFn: () => getCloudFiles(limit, 0),
    enabled: userId != null,
    placeholderData: keepPreviousData,
    throwOnError: true,
  });

  const files = useMemo(() => data?.items ?? [], [data]);

  // 表头写死「上传时间 ↓」，所以次序在这里保证（后端默认也是倒序，这里只是不让 UI 撒谎）。
  const tracks = useMemo(
    () =>
      files
        .filter((f): f is CloudTrack => f.song != null)
        .toSorted((a, b) => (b.addTimeMs ?? 0) - (a.addTimeMs ?? 0)),
    [files],
  );

  const handlePlay = useCallback(
    async (track: Song) => {
      try {
        await play(track);
      } catch (e) {
        toast.error(reportError('cloud.play', e, '播放失败'));
      }
    },
    [play],
  );

  const handlePlayAll = useCallback(async () => {
    const songs = tracks.map((t) => t.song);
    if (!songs.length) return;
    try {
      await replaceAndPlay(songs);
    } catch {
      toast.error('没有可播放的歌曲');
    }
  }, [replaceAndPlay, tracks]);

  return useMemo(
    () => ({
      tracks,
      /** 未能匹配到曲库的文件数（不可播放） */
      unmatched: files.length - tracks.length,
      count: data?.count ?? 0,
      usedBytes: data?.usedBytes,
      maxBytes: data?.maxBytes,
      /** 是否还有下一批（已取到的数量少于总数） */
      more: (data?.count ?? 0) > files.length,
      isLoading: userId != null && isPending,
      isLoadingMore: isPlaceholderData,
      handlePlay,
      handlePlayAll,
    }),
    [
      tracks,
      files.length,
      data?.count,
      data?.usedBytes,
      data?.maxBytes,
      userId,
      isPending,
      isPlaceholderData,
      handlePlay,
      handlePlayAll,
    ],
  );
}
