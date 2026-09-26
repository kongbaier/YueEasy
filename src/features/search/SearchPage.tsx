import { usePageTitle } from '@/app/layout/PageTitleContext';
import {
  Search,
  SearchHeader,
  SearchInput,
  SearchResultsDisplay,
  SearchTabs,
} from './components/Search';
import { SearchDropdown } from './components/SearchDropdown';

export default function SearchPage() {
  usePageTitle('搜索', { root: true });

  return (
    <Search>
      <SearchHeader className="mb-2">
        <SearchInput>
          <SearchDropdown />
        </SearchInput>
        <SearchTabs />
      </SearchHeader>
      <SearchResultsDisplay />
    </Search>
  );
}
