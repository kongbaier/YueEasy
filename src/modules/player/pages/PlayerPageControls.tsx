import {
  ChevronFirst,
  ChevronLast,
  HeartOff,
  ListMusic,
  Loader2,
  Pause,
  Play,
} from 'lucide-react';
import { useState } from 'react';
import { PlayModeControl } from '@/modules/player/components';
import { Button } from '@/shared/ui/button';
import { cn } from '@/shared/lib/utils';
import { toast } from '@/shared/lib/toast';
import { formatQueueCount } from '@/shared/utils/format';
import { usePlayer } from '@/modules/player/hooks/usePlayer';

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
      toast.success('已减少此类推荐');
    } catch {
      toast.error('操作失败，请重试');
    } finally {
      setTrashPending(false);
    }
  };

  return (
    <div
      className={`grid grid-cols-[auto_4fr_auto_3fr_auto_3fr_auto_4fr_auto] items-center ${className ?? ''}`}
    >
      <PlayModeControl className="col-start-1" />

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
        className="col-start-5 flex h-12 w-12 items-center justify-center rounded-full bg-primary hover:bg-primary/90 transition-transform hover:scale-105 active:scale-95"
        disabled={isLoading}
        onClick={togglePlay}
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
        onClick={next}
        size="icon"
        variant="ghost"
      >
        <ChevronLast className="size-5" />
      </Button>

      <Button
        className={cn(
          'col-start-9',
          !isFm &&
            (showQueue
              ? 'text-primary hover:text-primary'
              : 'text-foreground hover:bg-transparent hover:text-primary'),
          isFm && 'text-foreground hover:bg-transparent hover:text-primary',
        )}
        disabled={trashPending}
        onClick={isFm ? handleFmTrash : onToggleQueue}
        size="icon"
        title={isFm ? '不感兴趣' : '播放列表'}
        variant={showQueue && !isFm ? 'secondary' : 'ghost'}
      >
        {isFm ? (
          trashPending ? (
            <Loader2 className="size-5 animate-spin" />
          ) : (
            <HeartOff className="size-5" />
          )
        ) : (
          <span className="relative">
            <ListMusic className="size-5" />
            {queueLength > 0 && (
              <span className="absolute -top-1 -right-1.5 text-[9px] font-medium tabular-nums">
                {formatQueueCount(queueLength)}
              </span>
            )}
          </span>
        )}
      </Button>
    </div>
  );
};
