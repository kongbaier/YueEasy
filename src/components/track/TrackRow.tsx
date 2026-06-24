import { Crown, Heart, ListPlus, Play, SkipForward } from "lucide-react";
import { useCallback } from "react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { ImageWithFade } from "@/components/common/image";
import { Skeleton } from "@/components/ui/skeleton";
import type { SongRef } from "@/core/playlist/types";
import { formatDuration } from "@/lib/format";
import { toast } from "@/lib/toast";
import { getNcmImageUrl } from "@/lib/utils";
import { ncm } from "@/services/ncm";
import {
  useAuthStore,
  useLikeStore,
  usePlayerStore,
  useUiStore,
} from "@/stores";

interface TrackRowProps {
  track: SongRef;
  index: number;
  onPlay: (track: SongRef) => void;
}

export const TrackRow = ({ track, index, onPlay }: TrackRowProps) => {
  const playNext = usePlayerStore((s) => s.playNext);
  const addToQueue = usePlayerStore((s) => s.addToQueue);
  const isLiked = useLikeStore((s) => s.isLiked(track.id));
  const toggleLike = useLikeStore((s) => s.toggle);
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const setLoginDialogOpen = useUiStore((s) => s.setLoginDialogOpen);

  const handlePlayNext = () => {
    playNext(track);
  };

  const handleAddToQueue = () => {
    addToQueue(track);
    toast.success(`已添加到播放列表`);
  };

  const handleFavorite = useCallback(() => {
    if (!isLoggedIn) {
      toast.error("请先登录");
      setLoginDialogOpen(true);
      return;
    }
    const next = !isLiked;
    toggleLike(track.id);
    ncm
      .like(track.id, next)
      .then(() => {
        toast.success(
          next ? `已收藏 ${track.name}` : `已取消收藏 ${track.name}`,
        );
      })
      .catch(() => {
        toggleLike(track.id);
        toast.error("操作失败，请重试");
      });
  }, [
    track.id,
    track.name,
    isLiked,
    isLoggedIn,
    toggleLike,
    setLoginDialogOpen,
  ]);

  return (
    <ContextMenu>
      <ContextMenuTrigger
        className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors hover:bg-accent w-full text-left content-visibility-auto"
        onDoubleClick={() => onPlay(track)}
        onKeyDown={(e) => {
          if (e.key === "Enter") onPlay(track);
        }}
        role="button"
        style={{ containIntrinsicSize: "auto 52px" }}
        tabIndex={0}
      >
        <span className="w-8 text-center text-xs text-muted-foreground">
          {String(index + 1).padStart(2, "0")}
        </span>
        {track.album.picUrl && (
          <ImageWithFade
            alt={track.album.name}
            className="h-9 w-9 shrink-0 rounded object-cover"
            src={getNcmImageUrl(track.album.picUrl, 50)}
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
            {track.artists.map((a) => a.name).join("/") || "未知歌手"}
          </p>
        </div>
        <span className="flex-1 min-w-0 truncate text-xs text-muted-foreground">
          {track.album.name || "-"}
        </span>
        <button
          className="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:text-red-500"
          onClick={(e) => {
            e.stopPropagation();
            handleFavorite();
          }}
          title={isLiked ? "取消收藏" : "收藏"}
          type="button"
        >
          <Heart className="h-4 w-4" fill={isLiked ? "#ef4444" : "none"} />
        </button>
        <span className="w-10 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
          {formatDuration(track.duration / 1000)}
        </span>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={() => onPlay(track)}>
          <Play className="h-4 w-4" />
          播放
        </ContextMenuItem>
        <ContextMenuItem onClick={handlePlayNext}>
          <SkipForward className="h-4 w-4" />
          下一首播放
        </ContextMenuItem>
        <ContextMenuItem onClick={handleAddToQueue}>
          <ListPlus className="h-4 w-4" />
          添加到播放列表
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={handleFavorite}>
          <Heart className="h-4 w-4" fill={isLiked ? "#ef4444" : "none"} />
          {isLiked ? "取消收藏" : "收藏"}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
};

export const TrackRowSkeleton = ({ index }: { index: number }) => {
  return (
    <div className="flex items-center gap-3 rounded-lg px-3 py-2">
      <span className="w-8 text-center text-xs text-muted-foreground">
        {String(index + 1).padStart(2, "0")}
      </span>
      <Skeleton className="h-9 w-9 shrink-0 rounded" shimmer />
      <div className="flex-1 min-w-0 space-y-1.5">
        <Skeleton className="h-4 w-full max-w-48 rounded" shimmer />
        <Skeleton className="h-3 w-24 rounded" shimmer />
      </div>
      <Skeleton className="h-3 w-24 rounded flex-1 min-w-0" shimmer />
      <Skeleton className="h-4 w-4 shrink-0 rounded" shimmer />
      <Skeleton className="h-3 w-10 shrink-0 rounded" shimmer />
    </div>
  );
};
