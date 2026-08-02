import { Search as SearchIcon, X } from "lucide-react";
import { useCallback, useState } from "react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import type { SongRef } from "@/shared/types/playlist";
import { useLoadMore } from "@/shared/hooks/useLoadMore";
import { ScrollContainerContext } from "@/shared/hooks/useLoadMore";
import { toast } from "@/shared/lib/toast";
import { cn } from "@/shared/lib/utils";
import { SEARCH_TABS } from "./constants";
import { HotDropdown } from "./HotDropdown";
import { SearchResults } from "./SearchResults";
import { useSearchStore } from "./store";
import { SuggestDropdown } from "./SuggestDropdown";
import { useQueueStore } from "../player/stores/queue";

// ---- layout ----

export function Search({ children }: { children?: React.ReactNode }) {
  return <div className="flex flex-col h-full">{children}</div>;
}

export function SearchHeader({ children }: { children?: React.ReactNode }) {
  return <div className="shrink-0 px-6 pt-6">{children}</div>;
}

// ---- search input ----

export function SearchInput({
  onFocus,
  children,
}: {
  onFocus?: () => void;
  children?: React.ReactNode;
}) {
  const input = useSearchStore((s) => s.input);

  const submit = (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) return;
    useSearchStore.setState({ searchKeyword: trimmed, show: null });
  };

  return (
    <form
      autoComplete="off"
      className="flex items-center gap-2"
      onSubmit={submit}
    >
      <div className="relative flex-1">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground z-10" />
        <Input
          autoComplete="off"
          autoFocus
          className="pl-10 pr-8 h-9"
          onChange={(e) => useSearchStore.setState({ input: e.target.value })}
          onFocus={onFocus}
          placeholder="搜索歌曲、歌手、专辑..."
          value={input}
        />
        {input && (
          <button
            className="absolute right-2 top-1/2 -translate-y-1/2 size-5 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            onClick={() => useSearchStore.setState({ input: "" })}
            type="button"
          >
            <X className="size-3.5" />
          </button>
        )}
        {children}
      </div>
      <Button className="h-9" size="sm" type="submit">
        搜索
      </Button>
    </form>
  );
}

// ---- tabs ----

export function SearchTabs() {
  const searchType = useSearchStore((s) => s.searchType);

  return (
    <div className="flex items-center gap-1 mt-3">
      {SEARCH_TABS.map((tab) => (
        <button
          className={cn(
            "px-3 py-1 text-sm rounded-md transition-colors",
            searchType === tab.type
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground hover:bg-accent",
          )}
          key={tab.type}
          onClick={() => useSearchStore.setState({ searchType: tab.type })}
          type="button"
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

// ---- dropdown ----

export function SearchDropdown() {
  const show = useSearchStore((s) => s.show);
  const input = useSearchStore((s) => s.input);
  const hots = useSearchStore((s) => s.hots);
  const suggestions = useSearchStore((s) => s.suggestions);

  return (
    <>
      {show === "hot" && !input.trim() && hots.length > 0 && (
        <HotDropdown
          hots={hots}
          onClose={() => useSearchStore.setState({ show: null })}
          onPick={(keyword) => useSearchStore.setState({ input: keyword })}
        />
      )}
      {show === "suggest" && suggestions.length > 0 && (
        <SuggestDropdown
          items={suggestions}
          onClose={() => useSearchStore.setState({ show: null })}
          onPick={(keyword) =>
            useSearchStore.setState({ input: keyword, show: null })
          }
        />
      )}
    </>
  );
}

// ---- results ----

export function SearchResultsDisplay() {
  const results = useSearchStore((s) => s.results);
  const loading = useSearchStore((s) => s.loading);
  const error = useSearchStore((s) => s.error);
  const searchType = useSearchStore((s) => s.searchType);
  const searchKeyword = useSearchStore((s) => s.searchKeyword);
  const show = useSearchStore((s) => s.show);
  const play = useQueueStore((s) => s.play);

  const hasSearched = searchKeyword.trim().length > 0;

  const [scrollEl, setScrollEl] = useState<HTMLElement | null>(null);
  const scrollRef = useCallback(
    (el: HTMLDivElement | null) => setScrollEl(el),
    [],
  );
  const visibleCount = useLoadMore(results.length);

  const handlePlay = useCallback(
    async (track: SongRef) => {
      try {
        await play(track);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "播放失败");
      }
    },
    [play],
  );

  return (
    <ScrollContainerContext.Provider value={scrollEl}>
      <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-6" ref={scrollRef}>
        <SearchResults
          error={error}
          hasSearched={hasSearched}
          keyword={searchKeyword}
          loading={loading}
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
