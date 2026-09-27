import { Shuffle } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/ui/tooltip';
import { cn } from '@/shared/utils/cn';
import { usePlayer } from '@/features/player/hooks/usePlayer';

/**
 * 遍历顺序开关（正交轴 1：sequential / shuffle）。
 * 随机播放开启时高亮；私人漫游下禁用（漫游强制顺序遍历）。
 */
export const ShuffleButton = ({
  className,
  size = 'icon',
  iconSize = 5,
}: {
  className?: string;
  size?: 'icon' | 'icon-sm' | 'icon-lg';
  iconSize?: number;
}) => {
  const { isShuffle, isFm, toggleShuffle } = usePlayer();
  const label = '随机播放';

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            aria-label={label}
            className={cn(
              'hover:bg-transparent',
              className,
              isShuffle && 'text-primary hover:text-primary',
            )}
            disabled={isFm}
            onClick={toggleShuffle}
            size={size}
            variant="ghost"
          >
            <Shuffle className={`size-${iconSize}`} />
          </Button>
        }
      />
      <TooltipContent className="px-2 py-1.5" side="top" sideOffset={6}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
};
