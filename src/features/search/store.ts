import { create } from 'zustand';
import { SearchType } from './constants';

export type ShowDropdown = 'hot' | 'suggest' | null;

/**
 * search 页面的跨组件共享状态：输入态 + 搜索意图。
 *
 * 远程数据（结果 / 热词 / 建议）不在此处，由 React Query 持有；
 * `keyword` / `type` 留在 store 是为了离开本页再回来时能恢复上一次搜索
 * （路由无 keep-alive，组件卸载后 React Query 缓存会按 gcTime 兜底）。
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

  setInput: (input: string) => void;
  setShow: (show: ShowDropdown) => void;
  /** 提交输入框内容（trim 后为空则忽略） */
  submit: () => void;
  setType: (type: SearchType) => void;
}

export const useSearchStore = create<SearchState>((set, get) => ({
  input: '',
  show: null,
  keyword: '',
  type: SearchType.SONG,

  setInput: (input) => set({ input }),
  setShow: (show) => set({ show }),
  submit: () => {
    const keyword = get().input.trim();
    if (!keyword) return;
    set({ keyword, show: null });
  },
  setType: (type) => set({ type }),
}));
