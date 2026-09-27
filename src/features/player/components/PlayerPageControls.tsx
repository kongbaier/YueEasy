import { ChevronFirst, ChevronLast, Loader2, Pause, Play } from 'lucide-react';
import { RepeatButton, ShuffleButton } from '@/features/player/components';
import { Button } from '@/shared/ui/button';
import { usePlayer } from '@/features/player/hooks/usePlayer';
import { cn } from 'cn';

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
    <div className={cn('flex items-center justify-between gap-x-2', className)}>
      <RepeatButton />

      <Button
        className="text-foreground hover:bg-transparent hover:text-primary"
        disabled={!canPrev}
        onClick={prev}
        size="icon"
        variant="ghost"
      >
        <ChevronFirst className="size-5" />
      </Button>
      <Button
        className="flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground hover:bg-primary transition-transform hover:scale-100 active:scale-95"
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
        className="text-foreground hover:bg-transparent hover:text-primary"
        onClick={next}
        size="icon"
        variant="ghost"
      >
        <ChevronLast className="size-5" />
      </Button>

      <ShuffleButton />
    </div>
  );
};
