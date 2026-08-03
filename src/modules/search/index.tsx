import { useCallback } from 'react';
import { usePageTitle } from '@/app/layout/PageTitleContext';
import {
  Search,
  SearchDropdown,
  SearchHeader,
  SearchInput,
  SearchResultsDisplay,
  SearchTabs,
} from './Search';
import { useSearchController } from './useSearchController';
import {
  useSearchExecution,
  useSearchHot,
  useSearchSuggest,
} from './useSearch';

export default function SearchPage() {
  usePageTitle('搜索', { root: true });
  const { input, searchKeyword, searchType, setShow } = useSearchController();
  // Data hooks — write results to store, return refetch methods
  const searchHot = useSearchHot();
  const searchSuggest = useSearchSuggest();
  useSearchExecution(searchKeyword, searchType);

  // Wire focus: trigger hot/suggest refetch based on current input
  const handleFocus = useCallback(() => {
    if (!input.trim()) {
      searchHot.refetch();
      setShow('hot');
    } else {
      searchSuggest.refetch();
      setShow('suggest');
    }
  }, [searchHot, searchSuggest, input, setShow]);

  return (
    <Search>
      <SearchHeader>
        <SearchInput onFocus={handleFocus}>
          <SearchDropdown />
        </SearchInput>
        <SearchTabs />
      </SearchHeader>
      <SearchResultsDisplay />
    </Search>
  );
}
