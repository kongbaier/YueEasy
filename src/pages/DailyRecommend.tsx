import { useSuspenseQuery } from "@tanstack/react-query";
import { Play } from "lucide-react";
import { Suspense } from "react";
import { TrackRow, TrackRowSkeleton } from "@/components/track";
import { Skeleton } from "@/components/ui/skeleton";
import type { SongRef } from "@/core/playlist/types";
import { useLoadMore } from "@/hooks/useLoadMore";
import { toast } from "@/lib/toast";
import { ncm, toSongRef } from "@/services/ncm";
import { useAuthStore, usePlayerStore, useUiStore } from "@/stores";

const DailyRecommendSkeleton = () => {
  return (
    <div className="p-6">
      <Skeleton className="h-7 w-32 rounded" shimmer />
      <div className="mt-4 flex items-center gap-3">
        <Skeleton className="h-4 w-32 rounded" shimmer />
        <Skeleton className="h-7 w-24 rounded" shimmer />
      </div>
      <div className="mt-3 space-y-0.5">
        {Array.from({ length: 8 }).map((_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton array
          <TrackRowSkeleton index={i} key={i} showAlbum />
        ))}
      </div>
    </div>
  );
};

const DailyRecommendContent = () => {
  const play = usePlayerStore((s) => s.play);

  const { data: songs } = useSuspenseQuery({
    queryKey: ["dailyRecommend"],
    queryFn: () =>
      ncm
        .recommendSongs()
        .then((res) => (res.data.dailySongs ?? []).map(toSongRef)),
    staleTime: 5 * 60 * 1000,
  });

  const visibleCount = useLoadMore(songs.length);

  const handlePlay = async (track: SongRef) => {
    try {
      await play(track);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "播放失败");
    }
  };

  const handlePlayAll = async () => {
    for (const song of songs) {
      try {
        await play(song);
        return;
      } catch {
        /* try next */
      }
    }
    toast.error("没有可播放的歌曲");
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">每日推荐</h1>

      {songs.length > 0 ? (
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

          <div className="mt-3 space-y-0.5">
            {songs.slice(0, visibleCount).map((track, index) => (
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
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">暂无推荐歌曲</p>
      )}
    </div>
  );
};

export default function DailyRecommend() {
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
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
    <Suspense fallback={<DailyRecommendSkeleton />}>
      <DailyRecommendContent />
    </Suspense>
  );
}
