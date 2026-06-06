import { ChevronDown, Download, Ellipsis, Heart, Share2 } from "lucide-react";
import React, { Activity, useEffect, useState } from "react";
import { Lyrics } from "@/components/lyrics/Lyrics";
import { PlayerPageControls } from "@/components/player-page/PlayerPageControls";
import { PlayerPageProgress } from "@/components/player-page/PlayerPageProgress";
import { PlayerPageQueue } from "@/components/player-page/PlayerPageQueue";
import { PlayerPageVolume } from "@/components/player-page/PlayerPageVolume";
import { RatioContainer } from "@/components/RatioContainer";
import WindowControls from "@/components/system/WindowControls";
import { ImageWithFade } from "@/components/ui/image";
import type { Track } from "@/core/player/types";
import { cn } from "@/lib/utils";
import { usePlayerPageStore, usePlayerStore } from "@/stores";

export default function PlayerPage() {
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const isOpen = usePlayerPageStore((s) => s.isOpen);
  const close = usePlayerPageStore((s) => s.close);
  const [visible, setVisible] = useState(false);
  const [showQueue, setShowQueue] = useState(false);
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
        "fixed top-0 left-0 w-screen h-screen z-50 bg-background flex flex-col transition-transform duration-300 ease-out",
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
      <h1 className="text-xl font-semibold truncate">{currentTrack.name}</h1>
      <p className="text-sm text-muted-foreground mt-1 truncate">
        {currentTrack.artists?.map((a) => a.name).join(" / ")}
      </p>
    </div>
  );
};

const PlayerCover = ({ currentTrack }: { currentTrack: Track }) => {
  return (
    <RatioContainer>
      {currentTrack.album?.picUrl ? (
        <ImageWithFade
          alt={currentTrack.album.name}
          className={cn("object-cover", "rounded-lg shadow")}
          fill
          src={currentTrack.album.picUrl}
        />
      ) : (
        <div className="w-full h-full bg-secondary" />
      )}
    </RatioContainer>
  );
};

const PlayerMenu = ({
  currentTrack: _currentTrack,
}: {
  currentTrack: Track;
}) => {
  return (
    <div className="w-full shrink-0 h-1/10 flex justify-between items-center gap-1">
      <button
        className="flex items-center justify-center size-9 rounded hover:bg-surface-hover"
        type="button"
      >
        <Heart className="size-5" strokeWidth={1.5} />
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
