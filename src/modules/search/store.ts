import { create } from 'zustand';
import type { SuggestionItem } from './constants';
import { SearchType } from './constants';

export type ShowDropdown = 'hot' | 'suggest' | null;

interface SearchState {
  input: string;
  show: ShowDropdown;
  searchType: SearchType;
  searchKeyword: string;
  hots: string[];
  suggestions: SuggestionItem[];
  results: unknown[];
  total: number;
  loading: boolean;
  error: string;
}

export const useSearchStore = create<SearchState>(() => ({
  input: '',
  show: null,
  searchType: SearchType.SONG,
  searchKeyword: '',
  hots: [],
  suggestions: [],
  results: [],
  total: 0,
  loading: false,
  error: '',
}));
