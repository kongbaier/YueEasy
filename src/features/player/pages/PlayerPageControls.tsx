import {
  ChevronFirst,
  ChevronLast,
  ListMusic,
  Loader2,
  Pause,
  Play,
} from "lucide-react";
import { PlayModeControl } from "@/features/player/components";
import { Button } from "@/shared/ui/button";
import { usePlayerAction } from "@/features/player/hooks/usePlayerAction";
import { cn } from "@/shared/lib/utils";
import { useQueueStore } from "@/stores";
import { formatQueueCount } from "@/features/player/stores/queue";

interface PlayerPageControlsProps {
  className?: string;
  showQueue?: boolean;
  onToggleQueue?: () => void;
}

export const PlayerPageControls = ({
  className,
  showQueue = false,
  onToggleQueue,
}: PlayerPageControlsProps) => {
  const { handlePlay, handleNext, handlePrev, isPlaying, isLoading } =
    usePlayerAction();
  const queueLength = useQueueStore((s) => s.queueLength);

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
          {queueLength > 0 && (
            <span className="absolute -top-1 -right-1.5 text-[9px] font-medium tabular-nums">
              {formatQueueCount(queueLength)}
            </span>
          )}
        </span>
      </Button>
    </div>
  );
};
