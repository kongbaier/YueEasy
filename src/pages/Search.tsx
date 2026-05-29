import { Crown, Play, Search as SearchIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { useDebounce } from "@/hooks/useDebounce";
import { ncm } from "@/services/ncm";
import { resolveTrack } from "@/services/track";
import { usePlayerStore } from "@/stores";
import type { Track } from "@/types/music";

function TrackRow({
  track,
  index,
  onPlay,
}: {
  track: Track;
  index: number;
  onPlay: (t: Track) => void;
}) {
  return (
    // biome-ignore lint/a11y/useSemanticElements: compound widget with nested button
    <div
      className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-accent"
      onDoubleClick={() => onPlay(track)}
      onKeyDown={(e) => {
        if (e.key === "Enter") onPlay(track);
      }}
      role="button"
      tabIndex={0}
    >
      <span className="w-8 text-center text-xs text-muted-foreground">
        {String(index + 1).padStart(2, "0")}
      </span>
      {track.al?.picUrl && (
        <img
          alt={track.al.name}
          className="h-9 w-9 shrink-0 rounded object-cover"
          src={track.al.picUrl}
        />
      )}
      <div className="flex-1 min-w-0">
        <p className="flex items-center gap-1 min-w-0 font-medium">
          <span className="truncate">{track.name}</span>
          {track.fee === 1 && (
            <Crown className="h-3.5 w-3.5 shrink-0 text-amber-400" />
          )}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {track.ar?.map((a) => a.name).join("/") || "未知歌手"}
          {track.al?.name && ` · ${track.al.name}`}
        </p>
      </div>
      <button
        className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
        onClick={(e) => {
          e.stopPropagation();
          onPlay(track);
        }}
        title="播放"
        type="button"
      >
        <Play className="h-4 w-4" />
      </button>
    </div>
  );
}

export function Search() {
  const [keyword, setKeyword] = useState("");
  const [results, setResults] = useState<Track[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [playError, setPlayError] = useState("");
  const debouncedKeyword = useDebounce(keyword, 400);
  const play = usePlayerStore((s) => s.play);

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
          setResults(res.result.songs || []);
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

  const handlePlay = async (track: Track) => {
    setPlayError("");
    try {
      const resolved = await resolveTrack(track);
      play(resolved);
    } catch (e) {
      setPlayError(e instanceof Error ? e.message : "播放失败");
    }
  };

  const handlePlayAll = async () => {
    setPlayError("");
    for (const track of results) {
      try {
        const resolved = await resolveTrack(track);
        play(resolved);
        return;
      } catch {
        /* try next */
      }
    }
    setPlayError("没有可播放的歌曲");
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

            {playError && (
              <p className="mb-3 text-sm text-red-500">{playError}</p>
            )}

            <div className="space-y-0.5">
              {results.map((track, index) => (
                <TrackRow
                  index={index}
                  key={track.id}
                  onPlay={handlePlay}
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
