import { useCallback } from "react";
import { usePageTitle } from "@/app/layout/PageTitleContext";
import {
  Search,
  SearchDropdown,
  SearchHeader,
  SearchInput,
  SearchResultsDisplay,
  SearchTabs,
} from "./Search";
import { useSearchStore } from "./store";
import {
  useSearchExecution,
  useSearchHot,
  useSearchSuggest,
} from "./useSearch";

export default function SearchPage() {
  usePageTitle("搜索");
  // Data hooks — write results to store, return refetch methods
  const searchHot = useSearchHot();
  const searchSuggest = useSearchSuggest();
  useSearchExecution(
    useSearchStore((s) => s.searchKeyword),
    useSearchStore((s) => s.searchType),
  );

  // Wire focus: trigger hot/suggest refetch based on current input
  const handleFocus = useCallback(() => {
    const input = useSearchStore.getState().input;
    if (!input.trim()) {
      searchHot.refetch();
      useSearchStore.setState({ show: "hot" });
    } else {
      searchSuggest.refetch();
      useSearchStore.setState({ show: "suggest" });
    }
  }, [searchHot, searchSuggest]);

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
