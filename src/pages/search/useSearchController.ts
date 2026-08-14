import { useCallback } from 'react';
import { SearchType } from './constants';
import { useSearchStore } from './store';
import type { ShowDropdown } from './store';
import type { Song } from '@/shared/types/entities';
import { usePlayerStore } from '@/stores/player';
import { toast } from '@/shared/lib/toast';

/** search 页面的 ViewModel 控制器：组件只消费它，不直接碰 store。 */
export function useSearchController() {
  const input = useSearchStore((s) => s.input);
  const searchKeyword = useSearchStore((s) => s.searchKeyword);
  const searchType = useSearchStore((s) => s.searchType);
  const show = useSearchStore((s) => s.show);
  const hots = useSearchStore((s) => s.hots);
  const suggestions = useSearchStore((s) => s.suggestions);
  const results = useSearchStore((s) => s.results);
  const total = useSearchStore((s) => s.total);
  const loading = useSearchStore((s) => s.loading);
  const error = useSearchStore((s) => s.error);
  const play = usePlayerStore((s) => s.play);

  const setInput = (value: string) => useSearchStore.setState({ input: value });
  const submit = () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    useSearchStore.setState({ searchKeyword: trimmed, show: null });
  };
  const setType = (type: SearchType) =>
    useSearchStore.setState({ searchType: type });
  const clearInput = () => useSearchStore.setState({ input: '' });
  const setShow = (show: ShowDropdown) => useSearchStore.setState({ show });

  const handlePlay = useCallback(
    async (track: Song) => {
      try {
        await play(track);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : '播放失败');
      }
    },
    [play],
  );

  return {
    input,
    searchKeyword,
    searchType,
    show,
    hots,
    suggestions,
    results,
    total,
    loading,
    error,
    setInput,
    submit,
    setType,
    clearInput,
    setShow,
    handlePlay,
  };
}


