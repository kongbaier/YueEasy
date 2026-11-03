import { useCallback, useMemo } from 'react';
import { useEffectOnActive, useLayoutEffectOnActive } from 'keepalive-for-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getLikedSongs } from '../services/LikedSongsService';
import { likedSongsQueryKey, patchLikedSongs } from '../services/LikedSongsCache';
import { useLikeStore } from '../stores/like';
import { playerService } from '@/features/player/services/PlayerService';
import { toast } from '@/shared/lib/toast';
import { reportError } from '@/shared/utils/error';
import type { Song } from '@/shared/types/uiModels';

/**
 * 喜欢页 viewmodel：React Query 取数（歌单元信息 + 有序歌曲）+ playerService 命令。
 *
 * 列表语义是「**动态添加、延迟清除**」，不按 `likedIds` 动态渲染：
 * - **添加**：页内喜欢一首歌（播放栏 / TrackRow）→ `useLikeAction` 带 Song 元数据乐观插入
 *   本查询缓存，列表当帧变长（歌单详情快照做不到这一点，所以不能浅封装成 PlaylistPage）。
 * - **延迟清除**：页内取消喜欢**不动列表**（行保留、红心变空），用户发现点错了可以再点回来；
 *   真正剔除只发生在「进入页面」这一刻 —— 在 `useLayoutEffectOnActive` 里把缓存中已取消的项
 *   一次性剔掉（首次绘制前刷完，所以不会先闪旧列表再消失），随后静默后台重取。
 *
 * useQuery（非 suspense）+ enabled 门控：登录态翻转时只是不发请求，
 * 加载态与登录门禁都由页面 early return 承载（见 AGENTS.md §2）。
 */
export function useLikedSongsViewModel(userId: number | null) {
  const play = playerService.play;
  const replaceAndPlay = playerService.replaceAndPlay;
  const queryClient = useQueryClient();

  const { data, isPending } = useQuery({
    queryKey: likedSongsQueryKey(userId),
    queryFn: () => getLikedSongs(userId as number),
    enabled: userId != null,
    throwOnError: true,
  });

  // 延迟清除的唯一时机 = 进入页面。布局阶段写缓存 → 同步重渲染在首次绘制前完成。
  useLayoutEffectOnActive(() => {
    if (userId == null) return;
    const { likedIds } = useLikeStore.getState();
    patchLikedSongs(userId, (songs) => {
      const kept = songs.filter((song) => likedIds.has(song.id));
      return kept.length === songs.length ? songs : kept;
    });
  }, [userId]);

  // 后台重取：补齐其它端点的点赞与顺序/元信息变化。数据保留、不换骨架，静默。
  // skipMount = true：首次进入交给 useQuery 自己取，不重复请求。
  useEffectOnActive(
    () => {
      if (userId == null) return;
      void queryClient.invalidateQueries({
        queryKey: likedSongsQueryKey(userId),
        exact: true,
      });
    },
    [queryClient, userId],
    true,
  );

  // 列表就是缓存本身：不做 unlike 过滤（行保留是为了让用户能点错再点回来）。
  const songs = useMemo(() => data?.songs ?? [], [data]);
  const playlist = data?.playlist;

  const handlePlay = useCallback(
    async (track: Song) => {
      try {
        await play(track);
      } catch (e) {
        toast.error(reportError('liked.play', e, '播放失败'));
      }
    },
    [play],
  );

  const handlePlayAll = useCallback(async () => {
    if (songs.length === 0) return;
    try {
      await replaceAndPlay(songs);
    } catch {
      toast.error('没有可播放的歌曲');
    }
  }, [songs, replaceAndPlay]);

  return useMemo(
    () => ({ playlist, songs, isPending, handlePlay, handlePlayAll }),
    [playlist, songs, isPending, handlePlay, handlePlayAll],
  );
}
