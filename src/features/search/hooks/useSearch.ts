import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useSearchStore } from '../store';
import { useDebounced } from '@/shared/hooks/useDebounced';
import { hot, search, suggest } from '../search-service';

/** 热门搜索词：下拉展开且输入框为空时取数 */
export function useSearchHot() {
  const show = useSearchStore((s) => s.show);
  const input = useSearchStore((s) => s.input);

  return useQuery({
    queryKey: ['searchHot'],
    queryFn: hot,
    enabled: show === 'hot' && !input.trim(),
  });
}

/** 搜索建议：按下拉展开 + 防抖后的输入取数 */
export function useSearchSuggest() {
  const show = useSearchStore((s) => s.show);
  const input = useSearchStore((s) => s.input);
  const keyword = useDebounced(input.trim(), 200);

  return useQuery({
    queryKey: ['searchSuggest', keyword],
    queryFn: () => suggest(keyword),
    enabled: show === 'suggest' && keyword.length > 0,
    // 保留上一批建议，避免每次按键下拉面板闪烁收起
    placeholderData: keepPreviousData,
  });
}

/** 搜索结果：由已提交的 keyword + type 驱动，切换分类/关键词自动重取 */
export function useSearchResults() {
  const keyword = useSearchStore((s) => s.keyword);
  const type = useSearchStore((s) => s.type);

  return useQuery({
    queryKey: ['search', type, keyword],
    queryFn: () => search(keyword, type),
    enabled: keyword.trim().length > 0,
  });
}
