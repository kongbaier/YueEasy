import { Copy, Minus, Square, X } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { useWindowState } from '@/shared/hooks/useWindowState';
import { useMaximizeButtonSnap } from '@/shared/hooks/useMaximizeButtonSnap';
import { cn } from '@/shared/utils/cn';

export const WindowControls = ({ className }: { className?: string }) => {
  const { state, toggleMaximize, minimize, close } = useWindowState();

  // Win11 贴靠布局：最大化按钮交给原生命中测试，点击也由原生接管（见 useMaximizeButtonSnap）。
  const { ref: maximizeRef, hovered: maximizeHovered } = useMaximizeButtonSnap(
    state !== 'fullscreen',
  );

  const handleMinimize = () => void minimize();
  const handleClose = () => void close();

  if (state === 'fullscreen') return null;

  return (
    <div className={`flex z-50 text-foreground ${className}`} data-drag-region>
      <Button
        className="size-12 text-foreground flex items-center justify-center rounded-none border-none hover:bg-gray-500/20"
        onPointerUp={handleMinimize}
        type="button"
        variant="ghost"
      >
        <Minus className="size-4" />
      </Button>

      <Button
        ref={maximizeRef}
        className={cn(
          'size-12 text-foreground flex items-center justify-center rounded-none border-none hover:bg-gray-500/20',
          // 命中区归系统后 :hover 不再触发，用原生回灌的悬停态补高亮。
          maximizeHovered && 'bg-gray-500/20',
        )}
        onPointerUp={toggleMaximize}
        type="button"
        variant="ghost"
      >
        {state === 'maximized' ? (
          <Copy className="size-3" />
        ) : (
          <Square className="size-3" />
        )}
      </Button>

      <Button
        className="size-12 text-foreground flex items-center justify-center rounded-none border-none hover:bg-destructive hover:text-destructive-foreground"
        onPointerUp={handleClose}
        type="button"
        variant="ghost"
      >
        <X className="size-4" strokeWidth={1.5} />
      </Button>
    </div>
  );
};
