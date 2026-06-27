import { useQuery } from "@tanstack/react-query";
import { Play, Search as SearchIcon, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { SearchTabType } from "@/components/search/constants";
import { SEARCH_TABS, TYPE_LABEL } from "@/components/search/constants";
import { HotDropdown } from "@/components/search/HotDropdown";
import { SearchResults } from "@/components/search/SearchResults";
import type { SuggestionItem } from "@/components/search/SuggestDropdown";
import { SuggestDropdown } from "@/components/search/SuggestDropdown";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { SongRef } from "@/core/playlist/types";
import { useDebounce } from "@/hooks/useDebounce";
import { useLoadMore } from "@/hooks/useLoadMore";
import { ScrollContainerContext } from "@/hooks/useScrollContainer";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import type { SearchSuggestResponse } from "@/services/ncm";
import { ncm, toSongRef } from "@/services/ncm";
import { usePlayerStore } from "@/stores";

/** Extract display suggestions from the /search/suggest response */
function extractSuggestions(res: SearchSuggestResponse): SuggestionItem[] {
  const items: SuggestionItem[] = [];
  const { songs, albums, artists } = res.result;

  if (songs) {
    for (const s of songs.slice(0, 4)) {
      const artist = s.artists?.map((a) => a.name).join("/") || "";
      items.push({
        label: artist ? `${s.name} — ${artist}` : s.name,
        keyword: s.name,
        kind: "song" as const,
      });
    }
  }
  if (albums) {
    for (const a of albums.slice(0, 2)) {
      items.push({
        label: `${a.name} (专辑)`,
        keyword: a.name,
        kind: "album" as const,
      });
    }
  }
  if (artists) {
    for (const a of artists.slice(0, 2)) {
      items.push({
        label: `${a.name} (歌手)`,
        keyword: a.name,
        kind: "artist" as const,
      });
    }
  }
  return items.slice(0, 8);
}

export default function Search() {
  const [keyword, setKeyword] = useState("");
  const [searchKeyword, setSearchKeyword] = useState("");
  const [results, setResults] = useState<unknown[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const [searchType, setSearchType] = useState<SearchTabType>("1");
  const debouncedKeyword = useDebounce(keyword, 300);
  const play = usePlayerStore((s) => s.play);
  const replaceAndPlay = usePlayerStore((s) => s.replaceAndPlay);
  const visibleCount = useLoadMore(results.length);
  const inputRef = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);
  const [scrollEl, setScrollEl] = useState<HTMLElement | null>(null);
  const scrollRef = useCallback((el: HTMLDivElement | null) => {
    setScrollEl(el);
  }, []);
  const hasSearched = searchKeyword.trim().length > 0;

  const hotQuery = useQuery({
    queryKey: ["searchHot"],
    queryFn: () =>
      ncm.searchHot().then((res) => res.result.hots.map((h) => h.first)),
    staleTime: 5 * 60 * 1000,
    enabled: false,
  });

  // Fetch suggestions as user types (debounced)
  useEffect(() => {
    if (!debouncedKeyword.trim()) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    let cancelled = false;
    ncm
      .searchSuggest(debouncedKeyword)
      .then((res) => {
        if (!cancelled) {
          const items = extractSuggestions(res);
          setSuggestions(items);
          setShowSuggestions(items.length > 0);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSuggestions([]);
          setShowSuggestions(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedKeyword]);

  // Clear results when search keyword becomes empty
  useEffect(() => {
    if (!hasSearched) {
      setResults([]);
      setTotal(0);
    }
  }, [hasSearched]);

  // Search effect — fires on form submit or tab switch
  useEffect(() => {
    if (!hasSearched) return;

    let cancelled = false;
    setLoading(true);
    setError("");

    const doSearch = async () => {
      switch (searchType) {
        case "1": {
          const res = await ncm.search(searchKeyword, 30, 0);
          if (!cancelled) {
            setResults((res.result.songs || []).map(toSongRef));
            setTotal(res.result.songCount);
          }
          break;
        }
        case "10": {
          const res = await ncm.searchAlbum(searchKeyword, 30, 0);
          if (!cancelled) {
            setResults(res.result.albums || []);
            setTotal(res.result.albumCount);
          }
          break;
        }
        case "100": {
          const res = await ncm.searchArtist(searchKeyword, 30, 0);
          if (!cancelled) {
            setResults(res.result.artists || []);
            setTotal(res.result.artistCount);
          }
          break;
        }
        case "1002": {
          const res = await ncm.searchUser(searchKeyword, 30, 0);
          if (!cancelled) {
            setResults(res.result.userprofiles || []);
            setTotal(res.result.userprofileCount);
          }
          break;
        }
      }
      if (!cancelled) setLoading(false);
    };

    doSearch().catch((e) => {
      if (!cancelled) {
        setError(e instanceof Error ? e.message : "搜索失败");
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [searchKeyword, hasSearched, searchType]);

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

  const handlePlayAll = useCallback(async () => {
    if (!results.length || searchType !== "1") return;
    try {
      await replaceAndPlay(results as SongRef[]);
    } catch {
      toast.error("没有可播放的歌曲");
    }
  }, [results, searchType, replaceAndPlay]);

  const handleSubmit = useCallback(
    (e: React.SubmitEvent) => {
      e.preventDefault();
      const trimmed = keyword.trim();
      if (!trimmed) return;
      setSearchKeyword(trimmed);
      setShowSuggestions(false);
      setShowDropdown(false);
    },
    [keyword],
  );

  const handleHotPick = useCallback((word: string) => {
    setKeyword(word);
    setSearchKeyword(word);
    setShowDropdown(false);
    inputRef.current?.blur();
  }, []);

  const handleSuggestionPick = useCallback((suggestionKeyword: string) => {
    setKeyword(suggestionKeyword);
    setSearchKeyword(suggestionKeyword);
    setShowSuggestions(false);
    setShowDropdown(false);
  }, []);

  const handleClear = useCallback(() => {
    setKeyword("");
    setSearchKeyword("");
    setResults([]);
    setTotal(0);
    setError("");
    setShowDropdown(false);
    setShowSuggestions(false);
    setSuggestions([]);
    inputRef.current?.focus();
  }, []);

  const handleFocus = useCallback(() => {
    setFocused(true);
    if (!keyword.trim()) {
      setShowDropdown(true);
      hotQuery.refetch();
    } else {
      // Restore suggestions that were hidden by outside-click during blur
      setShowSuggestions(true);
    }
  }, [keyword, hotQuery]);

  const handleBlur = useCallback(() => {
    // Small delay so dropdown item clicks fire before the dropdown is removed
    setTimeout(() => setFocused(false), 150);
  }, []);

  const handleCloseDropdown = useCallback(() => {
    setShowDropdown(false);
  }, []);

  const handleCloseSuggestions = useCallback(() => {
    setShowSuggestions(false);
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setKeyword(e.target.value);
      setShowDropdown(false);
    },
    [],
  );

  const handleTabChange = useCallback((type: SearchTabType) => {
    setSearchType(type);
    setResults([]);
    setTotal(0);
  }, []);

  const hotWords = hotQuery.data ?? [];

  return (
    <div className="flex flex-col h-full">
      <div className="shrink-0 px-6 pt-6">
        <form autoComplete="off" className="flex items-center gap-2" onSubmit={handleSubmit}>
          <div className="relative flex-1">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground z-10" />
            <Input
              autoComplete="off"
              autoFocus
              className="pl-10 pr-8 h-9"
              onBlur={handleBlur}
              onChange={handleInputChange}
              onFocus={handleFocus}
              placeholder="搜索歌曲、歌手、专辑..."
              ref={inputRef}
              value={keyword}
            />
            {keyword && (
              <button
                className="absolute right-2 top-1/2 -translate-y-1/2 size-5 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                onClick={handleClear}
                type="button"
              >
                <X className="size-3.5" />
              </button>
            )}

            {/* Hot search dropdown — shown on focus when input is empty */}
            {showDropdown && !keyword.trim() && hotWords.length > 0 && (
              <HotDropdown
                onClose={handleCloseDropdown}
                onPick={handleHotPick}
                words={hotWords}
              />
            )}

            {/* Search suggestions dropdown — shown while typing and focused */}
            {focused && showSuggestions && suggestions.length > 0 && (
              <SuggestDropdown
                items={suggestions}
                onClose={handleCloseSuggestions}
                onPick={handleSuggestionPick}
              />
            )}
          </div>
          <Button className="h-9" size="sm" type="submit">
            搜索
          </Button>
        </form>

        {/* Search type tabs */}
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
              onClick={() => handleTabChange(tab.type)}
              type="button"
            >
              {tab.label}
            </button>
          ))}
        </div>

        {!loading && !error && results.length > 0 && (
          <div className="mt-3 flex items-center justify-between pb-2">
            <p className="text-sm text-muted-foreground">
              找到 <span className="text-foreground font-medium">{total}</span>{" "}
              {TYPE_LABEL[searchType]}
            </p>
            {searchType === "1" && (
              <Button onClick={handlePlayAll} size="xs">
                <Play className="size-3" />
                播放全部
              </Button>
            )}
          </div>
        )}
      </div>

      <ScrollContainerContext.Provider value={scrollEl}>
        <div
          className="flex-1 min-h-0 overflow-y-auto px-6 pb-6"
          ref={scrollRef}
        >
          <SearchResults
            error={error}
            hasSearched={hasSearched}
            keyword={searchKeyword}
            loading={loading}
            onPlay={handlePlay}
            results={results}
            searchType={searchType}
            showDropdown={showDropdown}
            visibleCount={visibleCount}
          />
        </div>
      </ScrollContainerContext.Provider>
    </div>
  );
}
