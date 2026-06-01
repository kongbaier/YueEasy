import { ChevronFirst, ChevronLast, Loader2, Pause, Play } from "lucide-react";
import { PlayModeControl } from "@/components/player/PlayModeControl";
import { usePlayerAction } from "@/hooks/usePlayerAction";
import { Button } from "../ui/button";

export function PlayerPageControls({ className }: { className?: string }) {
  const { handlePlay, handleNext, handlePrev, isPlaying, isLoading } =
    usePlayerAction();

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
        <Button
          className="flex h-12 w-12 items-center justify-center rounded-full bg-primary hover:bg-primary/90 transition-transform hover:scale-105 active:scale-95"
          disabled={isLoading}
          onClick={handlePlay}
          type="button"
        >
          {isLoading ? (
            <Loader2 className="size-5 animate-spin text-primary-foreground" />
          ) : isPlaying ? (
            <Pause className="size-5 fill-primary-foreground text-primary-foreground" />
          ) : (
            <Play className="size-5 fill-primary-foreground text-primary-foreground ml-0.5" />
          )}
        </Button>

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
