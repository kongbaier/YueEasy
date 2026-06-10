import { Play, Search as SearchIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { TrackRow } from "@/components/track";
import type { SongRef } from "@/core/playlist/types";
import { useDebounce } from "@/hooks/useDebounce";
import { useLoadMore } from "@/hooks/useLoadMore";
import { toast } from "@/lib/toast";
import { ncm, toSongRef } from "@/services/ncm";
import { usePlayerStore } from "@/stores";

export default function Search() {
  const [keyword, setKeyword] = useState("");
  const [results, setResults] = useState<SongRef[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const debouncedKeyword = useDebounce(keyword, 400);
  const play = usePlayerStore((s) => s.play);
  const visibleCount = useLoadMore(results.length);

  useEffect(() => {
    if (!debouncedKeyword.trim()) {
      setResults([]);
      setTotal(0);
    }
  }, [debouncedKeyword]);

  useEffect(() => {
    if (!debouncedKeyword.trim()) return;

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
  }, [debouncedKeyword]);

  const handlePlay = async (track: SongRef) => {
    try {
      await play(track);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "播放失败");
    }
  };

  const handlePlayAll = async () => {
    for (const track of results) {
      try {
        await play(track);
        return;
      } catch {
        /* try next */
      }
    }
    toast.error("没有可播放的歌曲");
  };

  return (
    <div className="p-6">
      <div className="relative max-w-md">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          className="w-full rounded-lg border border-border bg-card pl-10 pr-4 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="搜索歌曲、歌手、专辑..."
          value={keyword}
        />
      </div>

      <div className="mt-6">
        {loading && <p className="text-sm text-muted-foreground">搜索中...</p>}
        {error && <p className="text-sm text-red-500">{error}</p>}
        {!loading && !error && results.length === 0 && debouncedKeyword && (
          <p className="text-sm text-muted-foreground">未找到相关歌曲</p>
        )}

        {results.length > 0 && (
          <>
            <div className="mb-3 flex items-center gap-3">
              <p className="text-sm text-muted-foreground">
                找到 {total} 首歌曲
              </p>
              <button
                className="inline-flex items-center gap-1 rounded bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                onClick={handlePlayAll}
                type="button"
              >
                <Play className="h-3 w-3" />
                播放全部
              </button>
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
      </div>
    </div>
  );
}
