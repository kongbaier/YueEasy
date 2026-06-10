import { getCurrentWindow } from "@tauri-apps/api/window";
import { Copy, Minus, Square, X } from "lucide-react";
import { useEffect, useState } from "react";

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
      <button
        className="w-8 h-8 text-foreground flex items-center justify-center rounded hover:bg-gray-500/20"
        onPointerUp={handleMinimize}
        type="button"
      >
        <Minus className="w-4" />
      </button>

      <button
        className="w-8 h-8 text-foreground flex items-center justify-center rounded hover:bg-gray-500/20"
        onPointerUp={toggleMaximize}
        type="button"
      >
        {isMaximized ? <Copy className="w-3" /> : <Square className="w-3" />}
      </button>

      <button
        className="w-8 h-8 text-foreground flex items-center justify-center rounded hover:bg-red-500 hover:text-white"
        onPointerUp={handleClose}
        title="关闭"
        type="button"
      >
        <X className="w-4" strokeWidth={1.5} />
      </button>
    </div>
  );
};
