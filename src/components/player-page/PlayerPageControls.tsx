import {
  ChevronFirst,
  ChevronLast,
  ListMusic,
  Loader2,
  Pause,
  Play,
} from "lucide-react";
import { PlayModeControl } from "@/components/player/PlayModeControl";
import { usePlayerAction } from "@/hooks/usePlayerAction";
import { cn } from "@/lib/utils";
import { usePlayerStore } from "@/stores";
import { Button } from "../ui/button";

interface PlayerPageControlsProps {
  className?: string;
  showQueue?: boolean;
  onToggleQueue?: () => void;
}

export function PlayerPageControls({
  className,
  showQueue = false,
  onToggleQueue,
}: PlayerPageControlsProps) {
  const { handlePlay, handleNext, handlePrev, isPlaying, isLoading } =
    usePlayerAction();
  const queue = usePlayerStore((s) => s.queue);

  return (
    <div
      className={`grid grid-cols-[auto_4fr_auto_3fr_auto_3fr_auto_4fr_auto] items-center ${className ?? ""}`}
    >
      <PlayModeControl className="col-start-1" />

      <Button
        className="col-start-3 text-foreground hover:bg-transparent hover:text-primary"
        onClick={handlePrev}
        size="icon"
        variant="ghost"
      >
        <ChevronFirst className="size-5" />
      </Button>
      <Button
        className="col-start-5 flex h-12 w-12 items-center justify-center rounded-full bg-primary hover:bg-primary/90 transition-transform hover:scale-105 active:scale-95"
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

      <Button
        className="col-start-7 text-foreground hover:bg-transparent hover:text-primary"
        onClick={handleNext}
        size="icon"
        variant="ghost"
      >
        <ChevronLast className="size-5" />
      </Button>

      <Button
        className={cn(
          "col-start-9",
          showQueue
            ? "text-primary hover:text-primary"
            : "text-foreground hover:bg-transparent hover:text-primary",
        )}
        onClick={onToggleQueue}
        size="icon"
        title="播放列表"
        variant={showQueue ? "secondary" : "ghost"}
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
}
