import { useCallback, useMemo } from 'react';
import { useSearchStore } from '../store';
import type { Song } from '@/shared/types/uiModels';
import { playerService } from '@/features/player/services/PlayerService';
import { toast } from '@/shared/lib/toast';

/**
 * search 页面的 ViewModel：输入态 + 搜索意图 + 播放命令。
 * 远程数据由 hooks/useSearch.ts 的 query hooks 提供，组件按需组合。
 * 组件只消费本 hook，不直接碰 store。
 */
export function useSearchController() {
  const input = useSearchStore((s) => s.input);
  const show = useSearchStore((s) => s.show);
  const keyword = useSearchStore((s) => s.keyword);
  const searchType = useSearchStore((s) => s.type);
  const setInput = useSearchStore((s) => s.setInput);
  const setShow = useSearchStore((s) => s.setShow);
  const submit = useSearchStore((s) => s.submit);
  const setType = useSearchStore((s) => s.setType);
  const history = useSearchStore((s) => s.history);
  const removeHistory = useSearchStore((s) => s.removeHistory);

  const play = playerService.play;

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

  return useMemo(
    () => ({
      input,
      show,
      keyword,
      searchType,
      history,
      setInput,
      setShow,
      submit,
      setType,
      removeHistory,
      handlePlay,
    }),
    [
      input,
      show,
      keyword,
      searchType,
      history,
      setInput,
      setShow,
      submit,
      setType,
      removeHistory,
      handlePlay,
    ],
  );
}
