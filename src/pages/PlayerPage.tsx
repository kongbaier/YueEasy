import { ChevronDown, Download, Ellipsis, Heart, Share2 } from "lucide-react";
import React, { useEffect, useState } from "react";
import { Lyrics } from "@/components/lyrics/Lyrics";
import { PlayerPageControls } from "@/components/player-page/PlayerPageControls";
import { PlayerPageProgress } from "@/components/player-page/PlayerPageProgress";
import { PlayerPageVolume } from "@/components/player-page/PlayerPageVolume";
import { RatioContainer } from "@/components/RatioContainer";
import WindowControls from "@/components/system/WindowControls";
import type { Track } from "@/core/player/types";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { cn } from "@/lib/utils";
import { usePlayerPageStore, usePlayerStore } from "@/stores";

export function PlayerPage() {
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const isOpen = usePlayerPageStore((s) => s.isOpen);
  const close = usePlayerPageStore((s) => s.close);
  const isWide = useMediaQuery("(min-width: 1024px)");
  const [visible, setVisible] = useState(false);
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

      <RatioContainer
        className="flex-1 min-h-0"
        ratio={isWide ? 16 / 9 : 4 / 3}
      >
        <div className="grid grid-cols-[1fr_1fr] overflow-hidden">
          <div className="w-4/5 justify-self-center min-w-0 h-full min-h-0 flex flex-col items-center pb-4 gap-2 px-4">
            {currentTrack && (
              <React.Fragment>
                <PlayerTitle currentTrack={currentTrack} />

                <PlayerCover currentTrack={currentTrack} />

                <PlayerPageProgress className="shrink-0 w-full" />

                <PlayerPageControls className="w-full" />

                <PlayerPageVolume className="shrink-0 w-full" />

                <PlayerMenu currentTrack={currentTrack} />
              </React.Fragment>
            )}
          </div>

          <Lyrics className="border-l border-border overflow-hidden" />
        </div>
      </RatioContainer>
    </div>
  );
}

const PlayerHeader = ({ handleBack }: { handleBack: () => void }) => {
  return (
    <header
      className="flex items-center h-10 px-2 shrink-0"
      data-tauri-drag-region
    >
      <button
        className="flex items-center justify-center size-8 rounded hover:bg-accent"
        onClick={handleBack}
        type="button"
      >
        <ChevronDown className="size-5" />
      </button>
      <div className="flex-1" />
      <WindowControls />
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
        <img
          alt={currentTrack.album.name}
          className={cn("w-full h-full object-cover", "rounded-lg shadow-lg")}
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
  // const toggleFavorite = usePlayerStore((s) => s.toggleFavorite);
  return (
    <div className="w-full shrink-0 h-1/10 flex justify-between items-center gap-1">
      <button
        className="flex items-center justify-center size-9 rounded hover:bg-surface-hover"
        // onClick={() => toggleFavorite()}
        type="button"
      >
        <Heart
          className="size-5"
          // fill={currentTrack.isFavorite ? "currentColor" : "none"}
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
