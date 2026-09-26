import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { TauriStorage } from '@/tauri/storage';
import { SEARCH_HISTORY_MAX, SearchType } from './constants';

export type ShowDropdown = 'hot' | 'suggest' | null;

/**
 * search 页面的跨组件共享状态：输入态 + 搜索意图 + 搜索历史。
 *
 * 远程数据（结果 / 热词 / 建议）不在此处，由 React Query 持有；
 * `keyword` / `type` 留在 store 是为了离开本页再回来时能恢复上一次搜索
 * （路由无 keep-alive，组件卸载后 React Query 缓存会按 gcTime 兜底）。
 * `history` 是唯一持久化字段（TauriStorage），输入态等瞬态字段不落盘。
 */
interface SearchState {
  /** 输入框当前内容（尚未提交） */
  input: string;
  /** 展开中的下拉面板 */
  show: ShowDropdown;
  /** 已提交的搜索关键词 */
  keyword: string;
  /** 当前搜索分类 */
  type: SearchType;
  /** 搜索历史（最新在前、去重、上限 SEARCH_HISTORY_MAX） */
  history: string[];

  setInput: (input: string) => void;
  setShow: (show: ShowDropdown) => void;
  /** 提交输入框内容（trim 后为空则忽略），成功后写入历史 */
  submit: () => void;
  setType: (type: SearchType) => void;
  /** 新增一条历史（去重后置顶，超出上限截断） */
  addHistory: (keyword: string) => void;
  /** 删除一条历史 */
  removeHistory: (keyword: string) => void;
}

export const useSearchStore = create<SearchState>()(
  persist(
    (set, get) => ({
      input: '',
      show: null,
      keyword: '',
      type: SearchType.SONG,
      history: [],

      setInput: (input) => set({ input }),
      setShow: (show) => set({ show }),
      submit: () => {
        const keyword = get().input.trim();
        if (!keyword) return;
        set({ keyword, show: null });
        get().addHistory(keyword);
      },
      setType: (type) => set({ type }),
      addHistory: (keyword) => {
        const word = keyword.trim();
        if (!word) return;
        set((s) => ({
          history: [word, ...s.history.filter((w) => w !== word)].slice(
            0,
            SEARCH_HISTORY_MAX,
          ),
        }));
      },
      removeHistory: (keyword) =>
        set((s) => ({ history: s.history.filter((w) => w !== keyword) })),
    }),
    {
      name: 'search_history',
      storage: createJSONStorage(() => TauriStorage),
      // 只持久化历史；输入态 / 展开态 / 关键词是瞬态，不落盘
      partialize: (state) => ({ history: state.history }),
    },
  ),
);
