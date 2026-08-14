import { Infinity as InfinityIcon, Repeat, Repeat1 } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { cn } from "@/shared/utils/cn";
import { usePlayer } from "@/modules/player/hooks/usePlayer";
import type { RepeatMode } from "@/shared/types/player";

const repeatLabel: Record<RepeatMode, string> = {
  off: "顺序播放",
  all: "列表循环",
  one: "单曲循环",
};

/**
 * 终止策略循环器（正交轴 2：off / all / one）。
 *
 * 顺序播放（off）为默认，无独立 icon，与列表循环共用 `Repeat`；
 * 启用（all / one）时高亮区分。FM 下 off = 私人漫游、one = 单曲循环。
 */
export const RepeatButton = ({ className }: { className?: string }) => {
  const { repeat, cycleRepeat, isFm } = usePlayer();

  let Icon: typeof Repeat = repeat === "one" ? Repeat1 : Repeat;
  let label = repeatLabel[repeat];
  if (isFm && repeat !== "one") {
    Icon = InfinityIcon;
    label = "私人漫游";
  }

  const enabled = repeat !== "off";

  return (
    <div className={cn("relative group", className)}>
      <Button
        aria-label={label}
        className={cn(
          "hover:bg-transparent",
          enabled && "text-primary hover:text-primary",
        )}
        onClick={cycleRepeat}
        size="icon"
        title={label}
        variant="ghost"
      >
        <Icon className="size-5" />
      </Button>
      <span className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 whitespace-nowrap rounded-md border border-border/20 bg-[#2b2b2b] px-3 py-1.5 text-xs text-white opacity-0 shadow-md transition-opacity duration-150 group-hover:opacity-100">
        {label}
      </span>
    </div>
  );
};
