import {
  ChevronFirst,
  ChevronLast,
  ListMusic,
  Loader2,
  Pause,
  Play,
  ThumbsDown,
} from "lucide-react";
import { useState } from "react";
import { RepeatButton, ShuffleButton } from "@/modules/player/components";
import { Button } from "@/shared/ui/button";
import { cn } from "@/shared/lib/utils";
import { toast } from "@/shared/lib/toast";
import { formatQueueCount } from "@/shared/utils/format";
import { usePlayer } from "@/modules/player/hooks/usePlayer";

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
  const {
    togglePlay,
    next,
    prev,
    queueLength,
    canPrev,
    isFm,
    fmTrash,
    playing: isPlaying,
    loading: isLoading,
  } = usePlayer();
  const [trashPending, setTrashPending] = useState(false);

  const handleFmTrash = async () => {
    if (trashPending) return;
    setTrashPending(true);
    try {
      await fmTrash();
      toast.success("已减少此类推荐");
    } catch {
      toast.error("操作失败，请重试");
    } finally {
      setTrashPending(false);
    }
  };

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
