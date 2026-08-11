import {
  Infinity as InfinityIcon,
  Repeat,
  Repeat1,
  Shuffle,
} from "lucide-react";
import { Button } from "@/shared/ui/button";
import type { PlayMode } from "@/core/types";
import { cn } from "@/shared/lib/utils";
import { usePlayer } from "@/modules/player/hooks/usePlayer";

const modeIcon: Record<PlayMode, typeof Repeat> = {
  sequential: Repeat,
  shuffle: Shuffle,
  repeatOne: Repeat1,
};

const modeLabel: Record<PlayMode, string> = {
  sequential: "顺序播放",
  shuffle: "随机播放",
  repeatOne: "单曲循环",
};

export const PlayModeControl = ({ className }: { className?: string }) => {
  const { playMode, cyclePlayMode, isFm, exitFm } = usePlayer();

  // 漫游是队列来源而非播放模式，循环/随机切换对它无效：展示无穷大图标并转为退出操作
  const Icon = isFm ? InfinityIcon : modeIcon[playMode];

  return (
    <div className={cn("relative group", className)}>
      <Button
        className={cn(
          "hover:bg-transparent",
          isFm
            ? "text-primary hover:text-primary"
            : "text-foreground hover:text-primary",
        )}
        onClick={() => {
          if (isFm) {
            void exitFm();
            return;
          }
          cyclePlayMode();
        }}
        size="icon"
        title={isFm ? "退出私人漫游" : undefined}
        variant="ghost"
      >
        <Icon className="size-5" />
      </Button>
      {/* 纯 CSS tooltip：不依赖 JS 事件，PlayerBar 与播放页均可靠显示 */}
      <span className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 whitespace-nowrap rounded-md border border-border/20 bg-[#2b2b2b] px-3 py-1.5 text-xs text-white opacity-0 shadow-md transition-opacity duration-150 group-hover:opacity-100">
        {isFm ? "点击退出私人漫游" : modeLabel[playMode]}
      </span>
    </div>
  );
};
