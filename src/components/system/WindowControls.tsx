import { getCurrentWindow } from "@tauri-apps/api/window";
import { Copy, Minus, Square, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "../ui/button";

export const WindowControls = ({ className }: { className?: string }) => {
  const appWindow = getCurrentWindow();

  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    appWindow.onResized(async () => {
      const isMaximized = await appWindow.isMaximized();
      setIsMaximized(isMaximized);
    });
  }, [appWindow]);

  /** 最小化菜单 */
  const handleMinimize = () => appWindow.minimize();
  /** 关闭菜单 */
  const handleClose = () => appWindow.close();

  const toggleMaximize = async () => await appWindow.toggleMaximize();

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
        onPointerUp={toggleMaximize}
        type="button"
        variant="ghost"
      >
        {isMaximized ? (
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
