import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { getArtistAlbums } from '../artist-service';

/**
 * 歌手专辑 viewmodel：只在「专辑」分类激活时取数（`enabled` 门控），
 * 避免打开歌手页就多发一次请求。「加载更多」通过放大 `limit` 重取（queryKey 带 limit），
 * `keepPreviousData` 让翻页时旧列表留在屏幕上，不闪骨架。
 *
 * `isLoading` 里的 `enabled &&` 是必要的：useQuery 在禁用态下 `isPending` 恒为 true，
 * 直接用会显示永不消失的骨架。
 */
export function useArtistAlbumsViewModel(
  id: number,
  enabled: boolean,
  limit = 30,
) {
  const { data, isPending, isPlaceholderData } = useQuery({
    queryKey: ['artistAlbums', id, limit],
    queryFn: () => getArtistAlbums(id, 0, limit),
    enabled,
    placeholderData: keepPreviousData,
  });

  return {
    albums: data?.albums ?? [],
    more: data?.more ?? false,
    isLoading: enabled && isPending,
    isLoadingMore: isPlaceholderData,
  };
}
