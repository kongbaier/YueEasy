import {
  ChevronFirst,
  ChevronLast,
  ListMusic,
  Loader2,
  Pause,
  Play,
} from "lucide-react";
import { useMemo } from "react";
import { useShallow } from "zustand/shallow";
import { ImageWithFade } from "@/components/ui/image";
import { usePlayerAction } from "@/hooks/usePlayerAction";
import { useProgress } from "@/hooks/useProgress";
import { cn } from "@/lib/utils";
import { usePlayerPageStore, usePlayerStore } from "@/stores";
import { useQueuePanelStore } from "@/stores/queuePanelStore";
import { PlayModeControl } from "../player/PlayModeControl";
import { SeekBar } from "../player/SeekBar";
import { VolumeControl } from "../player/VolumeControl";
import { Button } from "../ui/button";
import { Skeleton } from "../ui/skeleton";

const PlayerProgress = () => {
  const { percentage } = useProgress();
  const seek = usePlayerStore((s) => s.seek);
  const duration = usePlayerStore((s) => s.duration);

  return (
    <SeekBar
      barClassName="w-full h-1 origin-center transition-transform group-hover:scale-y-150 bg-surface-active relative select-none"
      className="absolute w-full -top-1.5 left-0 h-3 cursor-pointer flex items-center group"
      duration={duration}
      onSeek={seek}
      percentage={percentage}
    >
      {({ displayPercentage }) => (
        <div
          className="h-full bg-primary rounded-r-full"
          style={{ width: `${displayPercentage}%` }}
        />
      )}
    </SeekBar>
  );
};

const PlayerControls = () => {
  const { handlePlay, handleNext, handlePrev } = usePlayerAction();
  const state = usePlayerStore((s) => s.core.state);
  const PlayIcon = useMemo(() => {
    switch (state) {
      case "loading":
        return () => (
          <Loader2 className="size-4 animate-spin text-primary-foreground" />
        );
      case "playing":
        return () => <Pause className="size-4 text-primary-foreground" />;
      default:
        return () => <Play className="size-4 text-primary-foreground" />;
    }
  }, [state]);
  return (
    <article className="flex items-center gap-x-6">
      <section className="flex items-center">
        <PlayModeControl />
      </section>
      <section className="flex text-4xl gap-x-3 justify-center items-center-safe">
        <Button
          className="text-foreground hover:bg-transparent hover:text-primary"
          onClick={handlePrev}
          size="icon"
          variant="ghost"
        >
          <ChevronFirst className="size-5" />
        </Button>

        <button
          className="relative w-12 h-8 bg-primary rounded-2xl flex justify-center items-center cursor-pointer focus:outline-none"
          disabled={state === "loading"}
          onClick={handlePlay}
          type="button"
        >
          <PlayIcon />
        </button>

        <Button
          className="text-foreground hover:bg-transparent hover:text-primary"
          onClick={handleNext}
          size="icon"
          variant="ghost"
        >
          <ChevronLast className="size-5" />
        </Button>
      </section>
      <section className="flex items-center">
        <VolumeControl />
      </section>
    </article>
  );
};

const PlayerInfo = () => {
  const { currentTrack } = usePlayerStore();
  const openPlayerPage = usePlayerPageStore((s) => s.open);
  return (
    <div className="flex-1 min-w-0 flex items-center gap-3">
      <button
        className="rounded overflow-hidden shadow h-10 w-10 shrink-0 hover:scale-110 transition-transform origin-bottom-left"
        onClick={openPlayerPage}
        type="button"
      >
        {currentTrack?.album.picUrl ? (
          <ImageWithFade
            alt={currentTrack.album.name}
            className="object-cover"
            fill
            src={currentTrack.album.picUrl}
          />
        ) : (
          <Skeleton className="" />
        )}
      </button>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">
          {currentTrack?.name ?? "未在播放"}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {currentTrack?.artists?.map((a) => a.name).join("/") ?? " "}
        </p>
      </div>
    </div>
  );
};

const PlayerMenu = () => {
  const { open } = useQueuePanelStore(useShallow((s) => ({ open: s.open })));
  const queue = usePlayerStore((s) => s.queue);
  return (
    <div className="flex-1 flex items-center justify-end">
      <Button
        className="text-foreground hover:bg-transparent hover:text-primary"
        onClick={open}
        size="icon"
        variant="ghost"
      >
        <span className="relative">
          <ListMusic className="size-4" />
          {queue.length > 0 && (
            <span className="absolute -top-1 -right-1.5 text-[9px] font-medium tabular-nums">
              {queue.length}
            </span>
          )}
        </span>
      </Button>
    </div>
  );
};

export const PlayerBar = ({ className }: { className?: string }) => {
  return (
    <div
      className={cn(
        "relative border-t border-border bg-card px-4 flex items-center justify-between",
        className,
      )}
    >
      <PlayerProgress />

      <PlayerInfo />

      <PlayerControls />

      <PlayerMenu />
    </div>
  );
};
