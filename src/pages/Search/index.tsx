import { Play, Search as SearchIcon, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollContainerContext } from "@/hooks/useScrollContainer";
import { cn } from "@/lib/utils";
import { SEARCH_TABS, SearchType, TYPE_LABEL } from "./constants";
import { HotDropdown } from "./HotDropdown";
import { SearchResults } from "./SearchResults";
import { SuggestDropdown } from "./SuggestDropdown";
import { useSearchHot, useSearchSuggest } from "./useSearch";

// import { useSearch } from "./useSearch";

type ShowDropdown = "hot" | "suggest" | null;

export default function Search() {
  const [input, setInput] = useState("");
  const [show, setShow] = useState<ShowDropdown>(null);
  const [searchType, setSearchType] = useState<SearchType>(SearchType.SONG);

  const SearchHot = useSearchHot();
  const SearchSuggest = useSearchSuggest(input);

  const handleFocus = () => {
    if (!input.trim()) {
      SearchHot.refetch();
      setShow("hot");
    }
    if (input.trim()) {
      SearchSuggest.refetch();
      setShow("suggest");
    }
  };
  const handleBlur = () => {
    setShow(null);
  };

  const pickHot = (keyword: string) => {
    setInput(keyword);
  };

  const pickSuggest = (keyword: string) => {
    setInput(keyword);
    handleBlur();
  };

  return (
    <div className="flex flex-col h-full">
      {/* ---- 搜索头部 ---- */}
      <div className="shrink-0 px-6 pt-6">
        {/* 搜索栏 */}
        <form
          autoComplete="off"
          className="flex items-center gap-2"
          // onSubmit={submit}
        >
          <div className="relative flex-1">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground z-10" />
            <Input
              autoComplete="off"
              autoFocus
              className="pl-10 pr-8 h-9"
              onChange={(e) => setInput(e.target.value)}
              onFocus={handleFocus}
              placeholder="搜索歌曲、歌手、专辑..."
              value={input}
            />
            {input && (
              <button
                className="absolute right-2 top-1/2 -translate-y-1/2 size-5 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                onClick={() => setInput("")}
                type="button"
              >
                <X className="size-3.5" />
              </button>
            )}

            {show === "hot" && !input.trim() && SearchHot.hots.length > 0 && (
              <HotDropdown
                hots={SearchHot.hots}
                onClose={handleBlur}
                onPick={pickHot}
              />
            )}
            {show === "suggest" && SearchSuggest.suggestions.length > 0 && (
              <SuggestDropdown
                items={SearchSuggest.suggestions}
                onClose={handleBlur}
                onPick={pickSuggest}
              />
            )}
          </div>
          <Button className="h-9" size="sm" type="submit">
            搜索
          </Button>
        </form>

        {/* 分类标签 */}
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
              onClick={() => setSearchType(tab.type)}
              type="button"
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* 搜索摘要 */}
        {/* {!loading && !error && results.length > 0 && (
          <div className="mt-3 flex items-center justify-between pb-2">
            <p className="text-sm text-muted-foreground">
              找到 <span className="text-foreground font-medium">{total}</span>{" "}
              {TYPE_LABEL[searchType]}
            </p>
            {searchType === SearchType.SONG && (
              <Button onClick={playAll} size="xs">
                <Play className="size-3" />
                播放全部
              </Button>
            )}
          </div>
        )} */}
      </div>

      {/* ---- 搜索结果 ---- */}
      {/* <ScrollContainerContext.Provider value={scrollEl}>
        <div
          className="flex-1 min-h-0 overflow-y-auto px-6 pb-6"
          ref={scrollRef}
        >
          <SearchResults
            error={error}
            hasSearched={hasSearched}
            keyword={searchKeyword}
            loading={loading}
            onPlay={playTrack}
            results={results}
            searchType={searchType}
            showDropdown={showHot}
            visibleCount={visibleCount}
          />
        </div>
      </ScrollContainerContext.Provider> */}
    </div>
  );
}
