import { useQuery } from "@tanstack/react-query";
import { Play } from "lucide-react";
import { useState } from "react";
import { TrackRow } from "@/components/track/TrackRow";
import type { SongRef } from "@/core/playlist/types";
import { ncm, toSongRef } from "@/services/ncm";
import { useAuthStore, usePlayerStore, useUiStore } from "@/stores";

export default function DailyRecommend() {
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const [playError, setPlayError] = useState("");
  const play = usePlayerStore((s) => s.play);

  const {
    data: songs = [],
    isPending,
    isError,
    error,
  } = useQuery({
    queryKey: ["dailyRecommend"],
    queryFn: () =>
      ncm
        .recommendSongs()
        .then((res) => (res.data.dailySongs ?? []).map(toSongRef)),
    enabled: isLoggedIn,
    staleTime: 5 * 60 * 1000,
  });

  const handlePlay = async (track: SongRef) => {
    setPlayError("");
    try {
      await play(track);
    } catch (e) {
      setPlayError(e instanceof Error ? e.message : "播放失败");
    }
  };

  const handlePlayAll = async () => {
    setPlayError("");
    for (const song of songs) {
      try {
        await play(song);
        return;
      } catch {
        /* try next */
      }
    }
    setPlayError("没有可播放的歌曲");
  };

  const setLoginDialogOpen = useUiStore((s) => s.setLoginDialogOpen);

  if (!isLoggedIn) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold">每日推荐</h1>
        <p className="mt-4 text-sm text-muted-foreground">
          请先
          <button
            className="mx-1 cursor-pointer text-primary underline"
            onClick={() => setLoginDialogOpen(true)}
            type="button"
          >
            登录
          </button>
          后查看每日推荐歌曲
        </p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">每日推荐</h1>

      {isPending && (
        <p className="mt-4 text-sm text-muted-foreground">加载中...</p>
      )}
      {isError && (
        <p className="mt-4 text-sm text-red-500">
          {error instanceof Error ? error.message : "加载失败"}
        </p>
      )}

      {!isPending && !isError && songs.length > 0 && (
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
                showAlbum
                track={track}
              />
            ))}
          </div>
        </>
      )}

      {!isPending && !isError && songs.length === 0 && (
        <p className="mt-4 text-sm text-muted-foreground">暂无推荐歌曲</p>
      )}
    </div>
  );
}
