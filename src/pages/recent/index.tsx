import { Clock } from "lucide-react";
import { Suspense } from "react";
import { usePageTitle } from "@/app/layout/PageTitleContext";
import { Button } from "@/shared/ui/button";
import { TrackRow, TrackRowSkeleton } from "@/shared/components/track";
import { useAuthViewModel } from "@/modules/auth/hooks/useAuthViewModel";
import { usePlayerSetting } from "@/shared/hooks/useSetting";
import { useRecentPlaysViewModel } from "./useRecentPlaysViewModel";

const RecentPlaysSkeleton = () => (
  <div className="p-6">
    <div className="space-y-0.5">
      {Array.from({ length: 8 }).map((_, i) => (
        // oxlint-disable-next-line react/no-array-index-key
        <TrackRowSkeleton index={i} key={i} />
      ))}
    </div>
  </div>
);

const RecentPlaysContent = ({
  userId,
  localEnabled,
}: {
  userId: number | null;
  localEnabled: boolean;
}) => {
  const { items, visibleCount, handlePlay } = useRecentPlaysViewModel(
    userId,
    localEnabled,
  );

  return (
    <div className="p-6">
      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-2">
          <Clock className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">还没有播放记录</p>
        </div>
      ) : (
        <div className="space-y-0.5">
          {items.slice(0, visibleCount).map((item, index) => (
            <TrackRow
              badge={item.source === "local" ? "本地" : undefined}
              index={index}
              key={item.song.id}
              onPlay={handlePlay}
              track={item.song}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default function RecentPlays() {
  usePageTitle("最近播放", { root: true });
  const { isLoggedIn, userId, openLogin } = useAuthViewModel();
  const [savePlaybackHistory] = usePlayerSetting("savePlaybackHistory");

  // 未登录且未开启本地播放记录时才需要登录；否则可用本地记录兜底。
  if (!isLoggedIn && !savePlaybackHistory) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <Clock className="h-12 w-12 text-muted-foreground" />
        <p className="text-muted-foreground">登录后查看最近播放</p>
        <Button onClick={openLogin}>立即登录</Button>
      </div>
    );
  }

  return (
    <Suspense fallback={<RecentPlaysSkeleton />}>
      <RecentPlaysContent
        localEnabled={savePlaybackHistory}
        userId={isLoggedIn ? userId : null}
      />
    </Suspense>
  );
}
