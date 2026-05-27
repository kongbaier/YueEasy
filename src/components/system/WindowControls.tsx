import { getCurrentWindow } from "@tauri-apps/api/window";
import { Minus, Square, X } from "lucide-react";

export default function WindowControls({ className }: { className?: string }) {
  const appWindow = getCurrentWindow();
  /** 最小化菜单 */
  const handleMinimize = () => appWindow.minimize();

  /** 关闭菜单 */
  const handleClose = () => appWindow.close();

  const toggleMaximize = () => appWindow.toggleMaximize();

  return (
    <div
      className={`flex space-x-1 z-50 text-white ${className}`}
      data-drag-region
    >
      <button
        className="w-8 h-8 text-black dark:text-white flex items-center justify-center rounded hover:bg-gray-500/20"
        onPointerUp={handleMinimize}
        type="button"
      >
        <Minus className="w-4" />
      </button>

      <button
        className="w-8 h-8 text-black dark:text-white flex items-center justify-center rounded hover:bg-gray-500/20"
        onPointerUp={toggleMaximize}
        type="button"
      >
        <Square className="w-3" />
      </button>

      <button
        className="w-8 h-8 text-black dark:text-white flex items-center justify-center rounded hover:bg-red-500 hover:text-white"
        onPointerUp={handleClose}
        title="关闭"
        type="button"
      >
        <X className="w-4" strokeWidth={1.5} />
      </button>
    </div>
  );
}
