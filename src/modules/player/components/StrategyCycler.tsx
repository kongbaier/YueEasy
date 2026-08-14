import { HeartPulse, Infinity as InfinityIcon, Redo2, Repeat, Repeat1, Shuffle } from "lucide-react";
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
 * 播放模式档位循环器（§2.6 迭代策略轴 × 内容来源轴）。
 *
 * 档位展示按内容来源分派：
 * - queue：顺序 / 列表循环 / 单曲循环 / 随机（shuffle 后若有心动条件则插「心动」）
 * - personal_fm：私人漫游（FM 前进）↔ 单曲循环（临时多听几遍）
 * - heartbeat：心动模式（点击切回普通队列）
 *
 * 高亮仅用于区分「顺序播放与列表循环」的同 Repeat 图标；其余模式用独立图标，无需高亮。
 */
export const StrategyCycler = ({ className }: { className?: string }) => {
  const { playMode, cycleStrategy, isFm, isHeartbeat } = usePlayer();

  let Icon: typeof Repeat = modeIcon[playMode];
  let label = modeLabel[playMode];
  let highlight = false;
  if (isHeartbeat) {
    Icon = HeartPulse;
    label = "心动模式";
  } else if (isFm) {
    if (playMode === 'repeatOne') {
      Icon = Repeat1;
      label = "单曲循环";
    } else {
      Icon = InfinityIcon;
      label = "私人漫游";
    }
  } else if (playMode === 'repeatAll') {
    highlight = true;
  }

  return (
    <div className={cn("relative group", className)}>
      <Button
        aria-label={label}
        className={cn(
          "hover:bg-transparent",
          highlight && "text-primary hover:text-primary",
        )}
        onClick={() => cycleStrategy()}
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
