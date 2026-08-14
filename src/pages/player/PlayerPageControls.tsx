import { ChevronFirst, ChevronLast, Loader2, Pause, Play } from "lucide-react";
import { RepeatButton, ShuffleButton } from "@/modules/player/components";
import { Button } from "@/shared/ui/button";
import { usePlayer } from "@/modules/player/hooks/usePlayer";

interface PlayerPageControlsProps {
  className?: string;
  showQueue?: boolean;
  onToggleQueue?: () => void;
}

export const PlayerPageControls = ({ className }: PlayerPageControlsProps) => {
  const {
    togglePlay,
    next,
    prev,
    canPrev,
    playing: isPlaying,
    loading: isLoading,
  } = usePlayer();

  return (
    <div
      className={`grid grid-cols-[auto_4fr_auto_3fr_auto_3fr_auto_4fr_auto] items-center ${className ?? ""}`}
    >
      <div className="col-start-1 flex items-center gap-x-1">
        <RepeatButton />
      </div>

      <Button
        className="col-start-3 text-foreground hover:bg-transparent hover:text-primary"
        disabled={!canPrev}
        onClick={prev}
        size="icon"
        variant="ghost"
      >
        <ChevronFirst className="size-5" />
      </Button>
      <Button
        className="col-start-5 flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground hover:bg-primary transition-transform hover:scale-100 active:scale-95"
        disabled={isLoading}
        onClick={togglePlay}
        type="button"
      >
        {isLoading ? (
          <Loader2 className="size-5 animate-spin" />
        ) : isPlaying ? (
          <Pause className="size-5 fill-primary-foreground" />
        ) : (
          <Play className="size-5 fill-primary-foreground ml-0.5" />
        )}
      </Button>

      <Button
        className="col-start-7 text-foreground hover:bg-transparent hover:text-primary"
        onClick={next}
        size="icon"
        variant="ghost"
      >
        <ChevronLast className="size-5" />
      </Button>

      <div className="col-start-9 flex items-center gap-x-1">
        <ShuffleButton />
      </div>
    </div>
  );
};
