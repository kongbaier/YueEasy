import { useCallback, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { homeService } from '../services/HomeService';
import { useQueueStore } from '@/modules/player/stores/queue';
import { usePlayerMirrorStore } from '@/stores/playerMirror';
import { queueItemToSong } from '@/shared/utils/mappers';
import { useAuthStore } from '@/stores/auth';
import { useLoginDialog } from '@/modules/auth/loginDialogStore';
import { usePlayerPage } from '@/modules/player/contexts/PlayerPageContext';
import { toast } from '@/shared/lib/toast';

/**
 * 私人漫游卡片 viewmodel：组合预请求候选歌 + queue store 的 enterFm / MirrorStore 的漫游状态。
 * 只订阅 store / context，组件不再直接触碰它们。
 */
export function useFmCardViewModel() {
  // Rust 模式下 queue store 的 syncQueueDerived 早退，isFm/currentTrack 恒空值；
  // 漫游状态改读 MirrorStore（fmActive / currentTrack wire 字段），enterFm action 仍走 queue store。
  const isFm = usePlayerMirrorStore((s) => s.fmActive);
  const enterFm = useQueueStore((s) => s.enterFm);
  const currentTrackRaw = usePlayerMirrorStore((s) => s.currentTrack);
  const currentTrack = currentTrackRaw ? queueItemToSong(currentTrackRaw) : null;
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const setLoginDialogOpen = useLoginDialog((s) => s.setOpen);
  const { open: openPlayerPage } = usePlayerPage();
  const queryClient = useQueryClient();
  const [pending, setPending] = useState(false);

  // 进入 home 页即预请求整批候选歌（仅登录且未在播放漫游时）
  const { data: previewSongs, isFetching: previewFetching } = useQuery({
    queryKey: ['personal-fm', 'preview'],
    queryFn: () => homeService.personalFmPreview().catch(() => []),
    enabled: isLoggedIn && !isFm,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const preview = previewSongs?.[0] ?? null;

  // 封面来源：正在漫游时用当前曲目，否则用预请求的候选歌
  const displaySong = isFm ? currentTrack : preview;

  // 候选仍在请求中且尚无内容时，先展示与 banner 一致的 shimmer 骨架
  const showFmSkeleton = isLoggedIn && !isFm && !displaySong && previewFetching;

  // openPage: true = 进入漫游并打开播放页；false = 只进入漫游停留在此页
  const startFm = useCallback(
    async (openPage: boolean) => {
      if (pending) return;
      if (!isLoggedIn) {
        toast.error('请先登录');
        setLoginDialogOpen(true);
        return;
      }
      // 已在漫游中：不再重复发起，仅做导航
      if (isFm) {
        if (openPage) openPlayerPage();
        return;
      }
      setPending(true);
      try {
        // 直接消费预请求的歌曲批次（封面对应的那首就是第一首播放的），service 已映射为 Track[]
        await enterFm(previewSongs ?? []);
        // 已消费，下次回到 home 重新拉新的推荐
        queryClient.invalidateQueries({ queryKey: ['personal-fm', 'preview'] });
        if (openPage) openPlayerPage();
      } catch {
        toast.error('操作失败，请重试');
      } finally {
        setPending(false);
      }
    },
    [
      pending,
      isLoggedIn,
      isFm,
      openPlayerPage,
      setLoginDialogOpen,
      enterFm,
      previewSongs,
      queryClient,
    ],
  );

  return useMemo(
    () => ({
      isFm,
      preview,
      previewFetching,
      displaySong,
      showFmSkeleton,
      pending,
      startFm,
    }),
    [
      isFm,
      preview,
      previewFetching,
      displaySong,
      showFmSkeleton,
      pending,
      startFm,
    ],
  );
}
