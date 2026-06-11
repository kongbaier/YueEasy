import { useQuery } from "@tanstack/react-query";
import {
  Play,
  Search as SearchIcon,
  SearchX,
  TrendingUp,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { TrackRow, TrackRowSkeleton } from "@/components/track";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { SongRef } from "@/core/playlist/types";
import { useDebounce } from "@/hooks/useDebounce";
import { useLoadMore } from "@/hooks/useLoadMore";
import { toast } from "@/lib/toast";
import { ncm, toSongRef } from "@/services/ncm";
import { usePlayerStore } from "@/stores";

const SKELETON_COUNT = 8;

const LoadingState = () => (
  <div className="mt-4 space-y-0.5">
    {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
      // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list, order never changes
      <TrackRowSkeleton index={i} key={i} showAlbum />
    ))}
  </div>
);

const HotDropdown = ({
  words,
  onPick,
  onClose,
}: {
  words: string[];
  onPick: (w: string) => void;
  onClose: () => void;
}) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  return (
    <div
      className="absolute top-full left-0 right-0 z-50 mt-1 overflow-hidden rounded-lg border border-border/40 bg-popover p-1 shadow-lg"
      ref={ref}
    >
      <div className="flex items-center gap-1.5 px-2.5 py-2">
        <TrendingUp className="size-4 text-orange-500" />
        <span className="text-xs font-medium text-muted-foreground">
          热门搜索
        </span>
      </div>
      <div className="max-h-64 overflow-y-auto">
        {words.map((word, i) => (
          <button
            className="flex items-center gap-3 w-full rounded-[3px] px-2.5 py-1.5 text-left text-sm text-foreground transition-colors hover:bg-accent"
            key={word}
            onClick={() => onPick(word)}
            type="button"
          >
            <span
              className={`w-5 text-center text-xs font-bold tabular-nums shrink-0 ${
                i < 3 ? "text-orange-500" : "text-muted-foreground"
              }`}
            >
              {i + 1}
            </span>
            <span className="flex-1 truncate">{word}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

const NoResults = ({ keyword }: { keyword: string }) => (
  <div className="flex flex-col items-center justify-center py-16 gap-3">
    <SearchX className="size-10 text-muted-foreground/30" />
    <p className="text-sm text-muted-foreground">
      没有找到与 "<span className="text-foreground font-medium">{keyword}</span>
      " 相关的结果
    </p>
  </div>
);

export default function Search() {
  const [keyword, setKeyword] = useState("");
  const [results, setResults] = useState<SongRef[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const debouncedKeyword = useDebounce(keyword, 400);
  const play = usePlayerStore((s) => s.play);
  const visibleCount = useLoadMore(results.length);
  const inputRef = useRef<HTMLInputElement>(null);
  const hasSearched = debouncedKeyword.trim().length > 0;

  const hotQuery = useQuery({
    queryKey: ["searchHot"],
    queryFn: () =>
      ncm
        .searchHot()
        .then((res) => res.result.hots.map((h) => h.first)),
    staleTime: 5 * 60 * 1000,
    enabled: false,
  });

  useEffect(() => {
    if (!hasSearched) {
      setResults([]);
      setTotal(0);
    }
  }, [hasSearched]);

  useEffect(() => {
    if (!hasSearched) return;

    let cancelled = false;
    setLoading(true);
    setError("");

    ncm
      .search(debouncedKeyword, 30, 0)
      .then((res) => {
        if (!cancelled) {
          setResults((res.result.songs || []).map(toSongRef));
          setTotal(res.result.songCount);
          setLoading(false);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "搜索失败");
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedKeyword, hasSearched]);

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
    for (const track of results) {
      try {
        await play(track);
        return;
      } catch {
        /* try next */
      }
    }
    toast.error("没有可播放的歌曲");
  }, [results, play]);

  const handleHotPick = useCallback((word: string) => {
    setKeyword(word);
    setShowDropdown(false);
  }, []);

  const handleClear = useCallback(() => {
    setKeyword("");
    setResults([]);
    setTotal(0);
    setError("");
    setShowDropdown(false);
    inputRef.current?.focus();
  }, []);

  const handleFocus = useCallback(() => {
    if (!keyword.trim()) {
      setShowDropdown(true);
      hotQuery.refetch();
    }
  }, [keyword, hotQuery]);

  const handleCloseDropdown = useCallback(() => {
    setShowDropdown(false);
  }, []);

  const hotWords = hotQuery.data ?? [];

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold tracking-tight mb-4">搜索</h1>
      <div className="relative max-w-lg mx-auto">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground z-10" />
        <Input
          autoFocus
          className="pl-10 pr-8 h-9"
          onChange={(e) => {
            setKeyword(e.target.value);
            setShowDropdown(false);
          }}
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

        {showDropdown && hotWords.length > 0 && (
          <HotDropdown
            onClose={handleCloseDropdown}
            onPick={handleHotPick}
            words={hotWords}
          />
        )}
      </div>

      <div className="mt-4 min-h-[200px]">
        {error && (
          <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20 px-4 py-3 text-sm text-red-600 dark:text-red-400">
            {error}
          </div>
        )}

        {loading && <LoadingState />}

        {!loading && !error && results.length > 0 && (
          <>
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                找到{" "}
                <span className="text-foreground font-medium">{total}</span>{" "}
                首歌曲
              </p>
              <Button onClick={handlePlayAll} size="xs">
                <Play className="size-3" />
                播放全部
              </Button>
            </div>

            <div className="space-y-0.5">
              {results.slice(0, visibleCount).map((track, index) => (
                <TrackRow
                  index={index}
                  key={track.id}
                  onPlay={handlePlay}
                  showAlbum
                  track={track}
                />
              ))}
            </div>
          </>
        )}

        {!loading && !error && hasSearched && results.length === 0 && (
          <NoResults keyword={debouncedKeyword} />
        )}

        {!hasSearched && !loading && !showDropdown && (
          <div className="flex flex-col items-center justify-center gap-3 text-muted-foreground pt-12">
            <SearchIcon className="size-10 opacity-20" />
            <p className="text-sm">点击搜索框发现热门音乐</p>
          </div>
        )}
      </div>
    </div>
  );
}
