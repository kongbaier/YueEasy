import {
  ChevronFirst,
  ChevronLast,
  ListMusic,
  Pause,
  Play,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { usePlayerAction } from "@/hooks/usePlayerAction";
import { useProgress } from "@/hooks/useProgress";
import { cn } from "@/lib/cn";
import { usePlayerStore } from "@/stores";
import { PlayModeControl } from "../player/PlayModeControl";
import { SeekBar } from "../player/SeekBar";
import { VolumeControl } from "../player/VolumeControl";
import { Button } from "../ui/button";

const PlayerProgress = () => {
  const { percentage } = useProgress();
  const seek = usePlayerStore((s) => s.seek);
  const duration = usePlayerStore((s) => s.duration);

  return (
    <SeekBar
      barClassName="w-full h-1 origin-center transition-transform group-hover:scale-y-200 bg-surface-active relative select-none"
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
  const { handlePlay, handleNext, handlePrev, isPlaying } = usePlayerAction();
  return (
    <article className="flex items-center gap-x-6">
      <section className="flex items-center">
        <PlayModeControl />
      </section>
      <section className="flex text-4xl gap-x-3 justify-center items-center-safe">
        <Button onPointerUp={handlePrev} variant="icon">
          <ChevronFirst className="size-5" />
        </Button>

        <Button
          className="relative w-12 h-8 bg-primary rounded-2xl flex justify-center items-center cursor-pointer focus:outline-none"
          onClick={handlePlay}
          type="button"
        >
          {isPlaying ? (
            <Pause className="size-4" />
          ) : (
            <Play className="size-4" />
          )}
        </Button>

        <Button onPointerUp={handleNext} variant="icon">
          <ChevronLast className="size-5" />
        </Button>
      </section>
      <section className="flex items-center">
        <VolumeControl />
      </section>
    </article>
  );
};

export function PlayerBar({ className }: { className?: string }) {
  const navigate = useNavigate();
  const { currentTrack } = usePlayerStore();

  return (
    <div
      className={cn(
        "relative border-t border-border bg-card px-4 flex items-center justify-between",
        className,
      )}
    >
      <PlayerProgress />

      <div className="flex-1 min-w-0">
        <button
          className="flex gap-3 min-w-45 max-w-70 items-center rounded p-0.5 text-left transition-colors hover:bg-accent"
          onClick={() => navigate("/player")}
          type="button"
        >
          {currentTrack?.album.picUrl ? (
            <img
              alt={currentTrack.album.name}
              className="h-10 w-10 shrink-0 rounded object-cover"
              src={currentTrack.album.picUrl}
            />
          ) : (
            <div className="h-10 w-10 shrink-0 rounded bg-secondary" />
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">
              {currentTrack?.name ?? "未在播放"}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {currentTrack?.artists?.map((a) => a.name).join("/") ?? " "}
            </p>
          </div>
        </button>
      </div>

      <PlayerControls />

      <div className="flex-1 flex items-center justify-end">
        <ListMusic />
      </div>
    </div>
  );
}
