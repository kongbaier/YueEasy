import { getCurrentWindow } from '@tauri-apps/api/window';
import { Copy, Minus, Square, X } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { useWindowState } from '@/shared/hooks/useWindowState';

export const WindowControls = ({ className }: { className?: string }) => {
  const appWindow = getCurrentWindow();
  const { state, toggleMaximize } = useWindowState();

  const handleMinimize = () => appWindow.minimize();
  const handleClose = () => appWindow.close();
  const handleMaximize = async () => await toggleMaximize();

  // Hide all controls when in fullscreen to avoid Tauri maximize/fullscreen conflict.
  if (state === 'fullscreen') return null;

  return (
    <div
      className={`flex space-x-1 z-50 text-foreground ${className}`}
      data-drag-region
    >
      <Button
        className="w-8 h-8 text-foreground flex items-center justify-center rounded hover:bg-gray-500/20"
        onPointerUp={handleMinimize}
        type="button"
        variant="ghost"
      >
        <Minus className="size-4" />
      </Button>

      <Button
        className="w-8 h-8 text-foreground flex items-center justify-center rounded hover:bg-gray-500/20"
        onPointerUp={handleMaximize}
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
        className="w-8 h-8 text-foreground flex items-center justify-center rounded hover:bg-red-500 hover:text-white"
        onPointerUp={handleClose}
        type="button"
        variant="ghost"
      >
        <X className="size-4" strokeWidth={1.5} />
      </Button>
    </div>
  );
};
