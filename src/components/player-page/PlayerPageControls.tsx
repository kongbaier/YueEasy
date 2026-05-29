import { ChevronFirst, ChevronLast, Pause, Play } from "lucide-react";
import { PlayModeControl } from "@/components/player/PlayModeControl";
import { usePlayerAction } from "@/hooks/usePlayerAction";

export function PlayerPageControls({ className }: { className?: string }) {
  const { handlePlay, handleNext, handlePrev, isPlaying } = usePlayerAction();

  return (
    <div className={`flex items-center justify-between ${className ?? ""}`}>
      <PlayModeControl />

      <div className="flex items-center gap-3">
        <button
          className="rounded p-1 text-muted-foreground transition-colors hover:text-foreground"
          onClick={handlePrev}
          type="button"
        >
          <ChevronFirst className="size-5" />
        </button>

        <button
          className="flex h-12 w-12 items-center justify-center rounded-full bg-primary hover:bg-primary/90 transition-transform hover:scale-105 active:scale-95"
          onClick={handlePlay}
          type="button"
        >
          {isPlaying ? (
            <Pause className="size-5 fill-primary-foreground text-primary-foreground" />
          ) : (
            <Play className="size-5 fill-primary-foreground text-primary-foreground ml-0.5" />
          )}
        </button>

        <button
          className="rounded p-1 text-muted-foreground transition-colors hover:text-foreground"
          onClick={handleNext}
          type="button"
        >
          <ChevronLast className="size-5" />
        </button>
      </div>

      <div className="w-7" />
    </div>
  );
}
