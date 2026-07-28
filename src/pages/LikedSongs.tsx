import { useSuspenseQuery } from "@tanstack/react-query";
import { Heart } from "lucide-react";
import { Suspense } from "react";
import { usePageTitle } from "@/app/layout/PageTitleContext";
import { useLoadMore } from "@/shared/hooks/useLoadMore";
import { toast } from "@/shared/lib/toast";
import { ncm, toSongRef } from "@/shared/services/ncm";
import type { SongRef } from "@/shared/types/playlist";
import { Button } from "@/shared/ui/button";
import { TrackRow, TrackRowSkeleton } from "@/shared/ui/track";
import { useAuthStore, usePlayerStore } from "@/stores";
import { useLoginDialog } from "@/features/auth/login-dialog-store";

const LikedSongsSkeleton = () => (
  <div className="p-6">
    <div className="space-y-0.5">
      {Array.from({ length: 8 }).map((_, i) => (
        // oxlint-disable-next-line react/no-array-index-key
        <TrackRowSkeleton index={i} key={i} />
      ))}
    </div>
  </div>
);

const LikedSongsContent = () => {
  const userId = useAuthStore((s) => s.userId);
  const play = usePlayerStore((s) => s.play);

  if (!userId) throw new Error("未登录");

  const { data: tracks } = useSuspenseQuery({
    queryKey: ["likedSongs", userId],
    queryFn: () =>
      ncm.likeList(userId).then((res) => {
        if (!res.ids.length) return [] as SongRef[];
        return ncm
          .songDetail(res.ids)
          .then((detail) => detail.songs.map(toSongRef));
      }),
  });

  const visibleCount = useLoadMore(tracks.length);

  const handlePlay = async (track: SongRef) => {
    try {
      await play(track);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "播放失败");
    }
  };

  return (
    <div className="p-6">
      {tracks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-2">
          <Heart className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">还没有喜欢的歌曲</p>
        </div>
      ) : (
        <div className="space-y-0.5">
          {tracks.slice(0, visibleCount).map((track, index) => (
            <TrackRow
              index={index}
              key={track.id}
              onPlay={handlePlay}
              track={track}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default function LikedSongs() {
  usePageTitle("我的喜欢", { root: true });
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const setLoginDialogOpen = useLoginDialog((s) => s.setOpen);

  if (!isLoggedIn) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <Heart className="h-12 w-12 text-muted-foreground" />
        <p className="text-muted-foreground">登录后查看我喜欢</p>
        <Button onClick={() => setLoginDialogOpen(true)}>立即登录</Button>
      </div>
    );
  }

  return (
    <Suspense fallback={<LikedSongsSkeleton />}>
      <LikedSongsContent />
    </Suspense>
  );
}
