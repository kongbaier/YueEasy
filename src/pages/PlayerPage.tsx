import { ChevronDown, Download, Ellipsis, Heart, Share2 } from "lucide-react";
import React, { Activity, useCallback, useEffect, useState } from "react";
import { Lyrics } from "@/components/lyrics/Lyrics";
import { PlayerPageControls } from "@/components/player-page/PlayerPageControls";
import { PlayerPageProgress } from "@/components/player-page/PlayerPageProgress";
import { PlayerPageQueue } from "@/components/player-page/PlayerPageQueue";
import { PlayerPageVolume } from "@/components/player-page/PlayerPageVolume";

import WindowControls from "@/components/system/WindowControls";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { ImageWithFade } from "@/components/ui/image";
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

export default function PlayerPage() {
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const isOpen = usePlayerPageStore((s) => s.isOpen);
  const close = usePlayerPageStore((s) => s.close);
  const [visible, setVisible] = useState(false);
  const [showQueue, setShowQueue] = useState(false);

  // Pre-decode next track cover for instant display on track change
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
      const raf = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(raf);
    }
    setVisible(false);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className={cn(
        "fixed top-0 left-0 w-screen h-screen z-50 bg-[#ffffff] dark:bg-[#121212] flex flex-col transition-transform duration-300 ease-out",
        visible ? "translate-y-0" : "translate-y-full",
      )}
    >
      <PlayerHeader handleBack={handleBack} />

      <div className="flex-1 grid grid-cols-[1fr_1fr] overflow-hidden">
        <div
          className={cn(
            "relative justify-self-center pb-4 gap-2 px-4",
            "flex flex-col items-center",
            "w-4/5 max-w-md",
          )}
        >
          {currentTrack && (
            <React.Fragment>
              <PlayerTitle currentTrack={currentTrack} />

              <PlayerCover currentTrack={currentTrack} />

              <PlayerPageProgress className="shrink-0 w-full" />

              <PlayerPageControls
                className="w-full"
                onToggleQueue={() => setShowQueue((v) => !v)}
                showQueue={showQueue}
              />

              <PlayerPageVolume className="shrink-0 w-full" />

              <PlayerMenu currentTrack={currentTrack} />
            </React.Fragment>
          )}
        </div>

        <div className="h-full min-h-0">
          <Activity mode={showQueue ? "visible" : "hidden"}>
            <PlayerPageQueue key="queue" />
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
    <header className="flex items-center h-10 shrink-0" data-tauri-drag-region>
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
    <div className="w-full h-14 overflow-hidden shrink-0">
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
  return (
    <AspectRatio
      className="rounded-lg shadow overflow-hidden dark:shadow-none"
      ratio={1}
    >
      {currentTrack.album?.picUrl ? (
        <ImageWithFade
          alt={currentTrack.album.name}
          className="object-cover"
          fill
          src={currentTrack.album.picUrl}
        />
      ) : (
        <div className="w-full h-full bg-secondary" />
      )}
    </AspectRatio>
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
