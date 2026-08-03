import { useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { homeService } from '../services/HomeService';
import { useAuthStore } from '@/stores/auth';
import { useLoginDialog } from '@/modules/auth/loginDialogStore';
import { toast } from '@/shared/lib/toast';

/**
 * 私人雷达卡片 viewmodel：组合圆形入口查询 + 歌单详情查询 + 跳转。
 * 封面选择逻辑（详情第一首歌封面 → 歌单封面 → 入口图标）收敛在 hook 内。
 */
export function useRadarCardViewModel() {
  const navigate = useNavigate();
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const setLoginDialogOpen = useLoginDialog((s) => s.setOpen);

  // 圆形入口接口需要登录，未登录时优雅降级为空
  const { data: dragonBalls, isFetching: dragonFetching } = useQuery({
    queryKey: ['dragon-ball'],
    queryFn: () => homeService.dragonBall().catch(() => []),
    enabled: isLoggedIn,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const radar = dragonBalls?.find(
    (item) => item.name === '私人雷达' || item.title === '私人雷达',
  );
  const resourceId = radar?.resourceId ? Number(radar.resourceId) : null;
  const hasResource = resourceId !== null && Number.isFinite(resourceId);

  // 有歌单 id 时再取一次详情，得到更真实的封面与歌单名；失败退回 iconUrl
  const { data: radarDetail, isFetching: radarFetching } = useQuery({
    queryKey: ['radar-playlist', resourceId],
    queryFn: () =>
      homeService.playlistDetail(resourceId as number).catch(() => null),
    enabled: isLoggedIn && hasResource,
    staleTime: 5 * 60 * 1000,
    retry: 0,
  });

  // 封面取歌单第一首歌的专辑图（更贴近"雷达正在放的第一首"），失败退回歌单封面/入口图标
  const coverUrl =
    radarDetail?.playlist?.tracks?.[0]?.al?.picUrl ??
    radarDetail?.playlist?.coverImgUrl ??
    radar?.iconUrl;
  const playlistName =
    radarDetail?.playlist?.name && radarDetail.playlist.name !== '私人雷达'
      ? radarDetail.playlist.name
      : '为你定制专属歌单';
  // 入口/歌单详情仍在请求中且尚无封面时，先展示与 banner 一致的 shimmer 骨架
  const showRadarSkeleton =
    isLoggedIn &&
    !coverUrl &&
    (dragonFetching || (hasResource && radarFetching));

  const goRadar = useCallback(() => {
    if (!isLoggedIn) {
      toast.error('请先登录');
      setLoginDialogOpen(true);
      return;
    }
    if (hasResource) navigate(`/playlist/${resourceId}`);
  }, [isLoggedIn, setLoginDialogOpen, hasResource, resourceId, navigate]);

  return useMemo(
    () => ({
      isLoggedIn,
      coverUrl,
      playlistName,
      showRadarSkeleton,
      goRadar,
    }),
    [isLoggedIn, coverUrl, playlistName, showRadarSkeleton, goRadar],
  );
}
