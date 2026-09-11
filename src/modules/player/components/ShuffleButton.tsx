import { Shuffle } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { cn } from '@/shared/utils/cn';
import { usePlayer } from '@/modules/player/hooks/usePlayer';

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
    <div className={cn('relative group', className)}>
      <Button
        aria-label={label}
        className={cn(
          'hover:bg-transparent',
          isShuffle && 'text-primary hover:text-primary',
        )}
        disabled={isFm}
        onClick={toggleShuffle}
        size={size}
        title={label}
        variant="ghost"
      >
        <Shuffle className={`size-${iconSize}`} />
      </Button>
      <span
        className={cn(
          'pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 whitespace-nowrap ',
          'rounded-md px-3 py-2 opacity-0 shadow-md transition-opacity duration-150 group-hover:opacity-100',
          'text-xs',
          'bg-popover text-popover-foreground border border-border shadow-md',
        )}
      >
        {label}
      </span>
    </div>
  );
};
