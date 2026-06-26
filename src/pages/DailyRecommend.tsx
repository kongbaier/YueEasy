import { useSuspenseQuery } from "@tanstack/react-query";
import { Play, Sparkles } from "lucide-react";
import { Suspense } from "react";
import { TrackRow, TrackRowSkeleton } from "@/components/track";
import { Button } from "@/components/ui/button";
import type { SongRef } from "@/core/playlist/types";
import { useLoadMore } from "@/hooks/useLoadMore";
import { toast } from "@/lib/toast";
import { ncm, toSongRef } from "@/services/ncm";
import { useAuthStore, usePlayerStore, useUiStore } from "@/stores";

const DailyRecommendSkeleton = () => (
  <div className="p-6">
    <h1 className="text-2xl font-bold">每日推荐</h1>
    <div className="mt-3 space-y-0.5">
      {Array.from({ length: 8 }).map((_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton array
        <TrackRowSkeleton index={i} key={i} />
      ))}
    </div>
  </div>
);

const DailyRecommendContent = () => {
  const play = usePlayerStore((s) => s.play);
  const replaceAndPlay = usePlayerStore((s) => s.replaceAndPlay);

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
    if (!songs.length) return;
    try {
      await replaceAndPlay(songs);
    } catch {
      toast.error("没有可播放的歌曲");
    }
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
            <Button onClick={handlePlayAll} size="xs">
              <Play className="h-3 w-3" />
              播放全部
            </Button>
          </div>

          <div className="mt-3 space-y-0.5">
            {songs.slice(0, visibleCount).map((track, index) => (
              <TrackRow
                index={index}
                key={track.id}
                onPlay={handlePlay}
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
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <Sparkles className="h-12 w-12 text-muted-foreground" />
        <p className="text-muted-foreground">登录后查看每日推荐</p>
        <Button onClick={() => setLoginDialogOpen(true)}>立即登录</Button>
      </div>
    );
  }

  return (
    <Suspense fallback={<DailyRecommendSkeleton />}>
      <DailyRecommendContent />
    </Suspense>
  );
}
