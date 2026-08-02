import { Repeat, Repeat1, Shuffle } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import type { PlayMode } from '@/core/types';
import { cn } from '@/shared/lib/utils';
import { useSettingsStore } from '@/stores/settings';

const modeIcon: Record<PlayMode, typeof Repeat> = {
  sequential: Repeat,
  shuffle: Shuffle,
  repeatOne: Repeat1,
};

export const PlayModeControl = ({ className }: { className?: string }) => {
  const playMode = useSettingsStore((s) => s.player.playMode);
  const cyclePlayMode = useSettingsStore((s) => s.cyclePlayMode);

  const Icon = modeIcon[playMode];

  return (
    <Button
      className={cn(
        'text-foreground hover:bg-transparent hover:text-primary',
        className,
      )}
      onClick={cyclePlayMode}
      size="icon"
      variant="ghost"
    >
      <Icon className="size-4" />
    </Button>
  );
};
