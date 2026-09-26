import { Search as SearchIcon, X } from 'lucide-react';
import { useCallback, useState } from 'react';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { useLoadMore } from '@/shared/hooks/useLoadMore';
import { ScrollContainerContext } from '@/shared/hooks/useLoadMore';
import { cn } from '@/shared/utils/cn';
import { SEARCH_TABS } from '../constants';
import { SearchResults } from './SearchResults';
import { useSearchController } from '../hooks/useSearchController';
import { useSearchResults } from '../hooks/useSearch';

// ---- layout ----

export function Search({ children }: { children?: React.ReactNode }) {
  return <div className="flex flex-col h-full">{children}</div>;
}

export function SearchHeader({
  children,
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return <div className={cn('shrink-0 px-6 pt-6', className)}>{children}</div>;
}

// ---- search input ----

export function SearchInput({ children }: { children?: React.ReactNode }) {
  const { input, setInput, setShow, submit } = useSearchController();

  const handleSubmit = (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    submit();
  };

  /** 空输入看向热门，有输入看向建议 */
  const showDropdownFor = (value: string) =>
    setShow(value.trim() ? 'suggest' : 'hot');

  const handleClear = () => {
    setInput('');
    setShow(null);
  };

  return (
    <form
      autoComplete="off"
      className="h-9 relative flex items-center gap-2"
      onSubmit={handleSubmit}
    >
      <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground z-10" />
      <Input
        autoComplete="off"
        autoFocus
        className="border border-border pl-10 pr-8 h-9"
        onChange={(e) => {
          setInput(e.target.value);
          showDropdownFor(e.target.value);
        }}
        onFocus={() => showDropdownFor(input)}
        placeholder="搜索歌曲、歌手、专辑..."
        value={input}
      />
      <div className={cn('absolute right-0 h-full', 'flex items-center gap-3')}>
        {input && (
          <Button
            className="size-5 flex items-center justify-center rounded-full text-muted-foreground transition-colors"
            onClick={handleClear}
            type="button"
            variant="ghost"
          >
            <X className="size-4" />
          </Button>
        )}
        <Button className="h-full rounded-l-none border-none" type="submit">
          搜索
        </Button>
      </div>

      {children}
    </form>
  );
}

// ---- tabs ----

export function SearchTabs() {
  const { searchType, setType } = useSearchController();

  return (
    <div className="flex items-center gap-1 mt-3">
      {SEARCH_TABS.map((tab) => (
        <button
          className={cn(
            'px-3 py-1 text-sm rounded-md transition-colors',
            searchType === tab.type
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground hover:bg-accent',
          )}
          key={tab.type}
          onClick={() => setType(tab.type)}
          type="button"
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

// ---- dropdown ----

// ---- results ----

export function SearchResultsDisplay() {
  const { keyword, searchType, show, handlePlay } = useSearchController();
  const { data, error, isLoading } = useSearchResults();

  const hasSearched = keyword.trim().length > 0;
  const results = data ?? null;

  const [scrollEl, setScrollEl] = useState<HTMLElement | null>(null);
  const scrollRef = useCallback(
    (el: HTMLDivElement | null) => setScrollEl(el),
    [],
  );
  const visibleCount = useLoadMore(results?.items.length ?? 0);

  return (
    <ScrollContainerContext.Provider value={scrollEl}>
      <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-6" ref={scrollRef}>
        <SearchResults
          error={error instanceof Error ? error.message : ''}
          hasSearched={hasSearched}
          keyword={keyword}
          loading={isLoading}
          onPlay={handlePlay}
          results={results}
          searchType={searchType}
          showDropdown={show !== null}
          visibleCount={visibleCount}
        />
      </div>
    </ScrollContainerContext.Provider>
  );
}
