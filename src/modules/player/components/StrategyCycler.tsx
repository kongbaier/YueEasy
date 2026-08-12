import { Redo2, Repeat, Repeat1, Shuffle } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { cn } from "@/shared/lib/utils";
import { usePlayer } from "@/modules/player/hooks/usePlayer";
import type { PlayMode } from "@/shared/types/player";

const modeIcon: Record<PlayMode, typeof Repeat> = {
  sequential: Redo2,
  repeatAll: Repeat,
  repeatOne: Repeat1,
  shuffle: Shuffle,
};

const modeLabel: Record<PlayMode, string> = {
  sequential: "顺序播放",
  repeatAll: "列表循环",
  repeatOne: "单曲循环",
  shuffle: "随机播放",
};

/**
 * 迭代策略循环器：4 种策略（顺序 / 列表循环 / 单曲循环 / 随机）——§2.6 迭代策略轴。
 *
 * FM（content_source == personal_fm）下策略字段被引擎忽略，控件以 disabled + muted 样式呈现。
 *
 * 顺序播放与列表循环复用 Repeat 图标，以「是否高亮（text-primary）」区分：
 * sequential 默认前景色；repeatAll 主色（点亮的循环状态）；其余模式独立图标。
 */
export const StrategyCycler = ({ className }: { className?: string }) => {
  const { playMode, cycleStrategy, isFm } = usePlayer();
  const Icon = modeIcon[playMode];

  return (
    <div className={cn("relative group", className)}>
      <Button
        aria-label={isFm ? "漫游模式下策略不可切换" : modeLabel[playMode]}
        className={cn("hover:bg-transparent")}
        disabled={isFm}
        onClick={() => cycleStrategy()}
        size="icon"
        title={isFm ? "漫游模式下策略不可切换" : modeLabel[playMode]}
        variant="ghost"
      >
        <Icon className="size-5" />
      </Button>
      <span className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 whitespace-nowrap rounded-md border border-border/20 bg-[#2b2b2b] px-3 py-1.5 text-xs text-white opacity-0 shadow-md transition-opacity duration-150 group-hover:opacity-100">
        {isFm ? "漫游模式下策略不可切换" : modeLabel[playMode]}
      </span>
    </div>
  );
};
