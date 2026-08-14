import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { SearchType } from './constants';
import { searchService } from './services/SearchService';
import { useSearchStore } from './store';

export function useSearchSuggest() {
  const mutation = useMutation({
    mutationFn: () => searchService.suggest(useSearchStore.getState().input),
    onSuccess: (suggestions) => useSearchStore.setState({ suggestions }),
    onError: () => useSearchStore.setState({ suggestions: [] }),
  });

  return { refetch: mutation.mutate };
}

export function useSearchHot() {
  const query = useQuery({
    queryKey: ['searchHot'],
    queryFn: () => searchService.hot(),
    staleTime: 5 * 60 * 1000,
    enabled: false,
  });

  useEffect(() => {
    if (query.data) useSearchStore.setState({ hots: query.data });
  }, [query.data]);

  return { refetch: query.refetch };
}

export function useSearchExecution(keyword: string, type: SearchType) {
  const cancelledRef = useRef(false);

  useEffect(() => {
    if (!keyword.trim()) return;

    cancelledRef.current = false;
    useSearchStore.setState({ loading: true, error: '' });

    searchService
      .search(keyword, type)
      .then(({ results, total }) => {
        if (!cancelledRef.current)
          useSearchStore.setState({ results, total, loading: false });
      })
      .catch((e) => {
        if (!cancelledRef.current)
          useSearchStore.setState({
            error: e instanceof Error ? e.message : '搜索失败',
            loading: false,
          });
      });

    return () => {
      cancelledRef.current = true;
    };
  }, [keyword, type]);
}
