import { useSuspenseQuery } from '@tanstack/react-query';
import { homeService } from '../services/HomeService';

/**
 * 首页 Banner viewmodel：只负责取数（service → infra）。
 * 轮播的 activeIndex / 容器宽度 / 图片预加载等 UI 逻辑留在 Banner 组件内。
 */
export function useHomeBannerViewModel() {
  const { data: banners } = useSuspenseQuery({
    queryKey: ['home_carousel'],
    queryFn: () =>
      homeService.banner().catch(() => {
        console.log('出现异常');
        return [];
      }),
  });

  return { banners };
}
