import { ChevronDown, Download, Ellipsis, Heart, Share2 } from "lucide-react";
import React, { Activity, useCallback, useEffect, useState } from "react";
import { WindowControls } from "@/components/system";
import { Cover } from "@/components/ui/cover";
import type { Track } from "@/core/player/types";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { ncm } from "@/services/ncm";
import {
  useAuthStore,
  useLikeStore,
  usePlayerPageStore,
  usePlayerStore,
  useUiStore,
} from "@/stores";
import { Lyrics } from "./lyrics/Lyrics";
import { PlayerPageControls } from "./PlayerPageControls";
import { PlayerPageProgress } from "./PlayerPageProgress";
import { PlayerPageQueue } from "./PlayerPageQueue";
import { PlayerPageVolume } from "./PlayerPageVolume";

export default function PlayerPage() {
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const isOpen = usePlayerPageStore((s) => s.isOpen);
  const close = usePlayerPageStore((s) => s.close);
  const [visible, setVisible] = useState(false);
  const [showQueue, setShowQueue] = useState(false);

  useEffect(() => {
    if (!currentTrack) return;
    const { queue } = usePlayerStore.getState();
    const idx = queue.findIndex((t) => t.id === currentTrack.id);
    const next = queue[idx + 1];
    if (next?.album?.picUrl) {
      const img = new Image();
      img.src = next.album.picUrl;
      img.decode().catch(() => {});
    }
  }, [currentTrack]);

  const handleBack = () => {
    setVisible(false);
    setTimeout(() => close(), 300);
  };

  useEffect(() => {
    if (isOpen) {
      setVisible(true);
    } else {
      setVisible(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 bg-[#ffffff] dark:bg-[#121212] transition-transform duration-300 ease-out",
        visible ? "translate-y-0" : "translate-y-full",
      )}
    >
      <PlayerHeader handleBack={handleBack} />

      <div className="relative h-[calc(100vh-40px)] grid grid-cols-[1fr_1fr] overflow-auto">
        <div
          className={cn(
            "col-span-1 justify-self-center min-h-0",
            "pb-4 gap-2 px-4",
            "flex flex-col justify-around",
            "w-4/5 max-w-md",
          )}
        >
          {currentTrack && (
            <React.Fragment>
              <PlayerTitle currentTrack={currentTrack} />
              <PlayerCover currentTrack={currentTrack} />
              <PlayerPageProgress />
              <PlayerPageControls
                onToggleQueue={() => setShowQueue((v) => !v)}
                showQueue={showQueue}
              />
              <PlayerPageVolume />
              <PlayerMenu currentTrack={currentTrack} />
            </React.Fragment>
          )}
        </div>

        <div className="col-span-1 min-h-0">
          <Activity mode={showQueue ? "visible" : "hidden"}>
            <PlayerPageQueue key="queue" onBack={handleBack} />
          </Activity>
          <Activity mode={showQueue ? "hidden" : "visible"}>
            <Lyrics />
          </Activity>
        </div>
      </div>
    </div>
  );
}

const PlayerHeader = ({ handleBack }: { handleBack: () => void }) => {
  return (
    <header className="flex items-center h-10 shrink-0" data-drag-region>
      <button
        className="flex items-center justify-center size-8 rounded ml-1 hover:bg-accent"
        onClick={handleBack}
        type="button"
      >
        <ChevronDown className="size-5" />
      </button>
      <WindowControls className="ml-auto mr-1" />
    </header>
  );
};

const PlayerTitle = ({ currentTrack }: { currentTrack: Track }) => {
  return (
    <div className="h-14">
      <h1 className="text-xl font-semibold text-foreground truncate">
        {currentTrack.name}
      </h1>
      <p className="text-sm text-muted-foreground mt-1 truncate">
        {currentTrack.artists?.map((a) => a.name).join(" / ")}
      </p>
    </div>
  );
};

const PlayerCover = ({ currentTrack }: { currentTrack: Track }) => {
  const picUrl = currentTrack?.album?.picUrl;

  return (
    <div className="flex-1 min-h-0 my-2 lg:my-4 flex items-center justify-center">
      <Cover
        alt={currentTrack.album.name}
        className="aspect-square max-h-full max-w-full"
        foregroundClassName="rounded-lg border-[0.5px]"
        src={picUrl}
      />
    </div>
  );
};

const PlayerMenu = ({ currentTrack }: { currentTrack: Track }) => {
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const setLoginDialogOpen = useUiStore((s) => s.setLoginDialogOpen);
  const isLiked = useLikeStore((s) => s.isLiked(currentTrack.id));
  const toggleLike = useLikeStore((s) => s.toggle);

  const handleLike = useCallback(() => {
    if (!isLoggedIn) {
      toast.error("请先登录");
      setLoginDialogOpen(true);
      return;
    }
    const next = !isLiked;
    toggleLike(currentTrack.id);
    ncm
      .like(currentTrack.id, next)
      .then(() => {
        toast.success(
          next
            ? `已收藏 ${currentTrack.name}`
            : `已取消收藏 ${currentTrack.name}`,
        );
      })
      .catch(() => {
        toggleLike(currentTrack.id);
        toast.error("操作失败，请重试");
      });
  }, [
    isLoggedIn,
    isLiked,
    currentTrack.id,
    currentTrack.name,
    toggleLike,
    setLoginDialogOpen,
  ]);

  return (
    <div className="w-full shrink-0 h-1/10 flex justify-between items-center gap-1 text-foreground">
      <button
        className="flex items-center justify-center size-9 rounded hover:bg-surface-hover"
        onClick={handleLike}
        type="button"
      >
        <Heart
          className={cn(
            "size-5",
            isLiked ? "text-red-500 fill-red-500" : "hover:text-primary",
          )}
          strokeWidth={1.5}
        />
      </button>
      <button
        className="flex items-center justify-center size-9 rounded hover:bg-surface-hover opacity-40"
        type="button"
      >
        <Download className="size-5" strokeWidth={1.5} />
      </button>
      <button
        className="flex items-center justify-center size-9 rounded hover:bg-surface-hover opacity-40"
        type="button"
      >
        <Share2 className="size-5" strokeWidth={1.5} />
      </button>
      <button
        className="flex items-center justify-center size-9 rounded hover:bg-surface-hover opacity-40"
        type="button"
      >
        <Ellipsis className="size-5" strokeWidth={1.5} />
      </button>
    </div>
  );
};
