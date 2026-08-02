import { useSuspenseQuery } from "@tanstack/react-query";
import { Play, Sparkles } from "lucide-react";
import { Suspense } from "react";
import { usePageTitle } from "@/app/layout/PageTitleContext";
import { useLoadMore } from "@/shared/hooks/useLoadMore";
import { toast } from "@/shared/lib/toast";
import { CacheKeys, cachedFetch } from "@/shared/services/cache";
import { ncm, toSongRef } from "@/shared/services/ncm";
import type { SongRef } from "@/shared/types/playlist";
import { Button } from "@/shared/ui/button";
import { TrackRow, TrackRowSkeleton } from "@/shared/ui/track";
import { useQueueStore } from "@/modules/player/stores/queue";
import { useAuthStore } from "@/stores/auth";
import { useLoginDialog } from "@/modules/auth/loginDialogStore";

const DailyRecommendSkeleton = () => (
  <div className="p-6">
    <div className="mt-3 space-y-0.5">
      {Array.from({ length: 8 }).map((_, i) => (
        // oxlint-disable-next-line react/no-array-index-key
        <TrackRowSkeleton index={i} key={i} />
      ))}
    </div>
  </div>
);

const DailyRecommendContent = () => {
  const play = useQueueStore((s) => s.play);
  const replaceAndPlay = useQueueStore((s) => s.replaceAndPlay);

  const today = new Date().toISOString().slice(0, 10);

  const { data: songs } = useSuspenseQuery({
    queryKey: ["dailyRecommend"],
    queryFn: () =>
      cachedFetch(CacheKeys.dailyRecommend(today), () =>
        ncm.recommendSongs(),
      ).then((r) => (r.data.data.dailySongs ?? []).map(toSongRef)),
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
  usePageTitle("每日推荐", { root: true });
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const setLoginDialogOpen = useLoginDialog((s) => s.setOpen);

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
