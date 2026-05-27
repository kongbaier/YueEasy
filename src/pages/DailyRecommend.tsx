import { Crown, Play } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ncm } from "@/services/ncm";
import { resolveTrack } from "@/services/track";
import { useAuthStore, usePlayerStore } from "@/stores";
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
      <span className="w-6 text-right text-xs text-muted-foreground">
        {index + 1}
      </span>
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

export function DailyRecommend() {
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const [songs, setSongs] = useState<Track[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [playError, setPlayError] = useState("");
  const play = usePlayerStore((s) => s.play);

  useEffect(() => {
    if (!isLoggedIn) return;

    let cancelled = false;
    setLoading(true);
    setError("");

    ncm
      .recommendSongs()
      .then((res) => {
        if (!cancelled) {
          setSongs(res.data?.dailySongs || []);
          setLoading(false);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "加载失败");
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isLoggedIn]);

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
    for (const song of songs) {
      try {
        const resolved = await resolveTrack(song);
        play(resolved);
        return;
      } catch {
        /* try next */
      }
    }
    setPlayError("没有可播放的歌曲");
  };

  if (!isLoggedIn) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold">每日推荐</h1>
        <p className="mt-4 text-sm text-muted-foreground">
          请先
          <Link className="mx-1 text-primary underline" to="/login">
            登录
          </Link>
          后查看每日推荐歌曲
        </p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">每日推荐</h1>

      {loading && (
        <p className="mt-4 text-sm text-muted-foreground">加载中...</p>
      )}
      {error && <p className="mt-4 text-sm text-red-500">{error}</p>}

      {!loading && !error && songs.length > 0 && (
        <>
          <div className="mt-4 flex items-center gap-3">
            <p className="text-sm text-muted-foreground">
              共 {songs.length} 首推荐歌曲
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
            <p className="mt-2 text-sm text-red-500">{playError}</p>
          )}

          <div className="mt-3 space-y-0.5">
            {songs.map((track, index) => (
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

      {!loading && !error && songs.length === 0 && (
        <p className="mt-4 text-sm text-muted-foreground">暂无推荐歌曲</p>
      )}
    </div>
  );
}
