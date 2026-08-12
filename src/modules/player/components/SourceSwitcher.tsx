import { Infinity as InfinityIcon } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { cn } from "@/shared/lib/utils";
import { usePlayer } from "@/modules/player/hooks/usePlayer";

/**
 * 内容来源退出控件：仅在 FM 模式下渲染（§2.6 内容来源轴）。
 * - 私人漫游（FM）：Infinity 图标、主色高亮，点击 → setContentSource('queue')
 * - 本地队列：不渲染 —— 进入漫游的唯一入口仍是首页 FmCard（避免在 PlayerBar 额外加按钮）
 *
 * 与 StrategyCycler 解耦：策略切换与来源退出分属两个控件、两套语义。
 */
export const SourceSwitcher = ({ className }: { className?: string }) => {
  const { isFm, setContentSource } = usePlayer();
  if (!isFm) return null;
  const Icon = InfinityIcon;

  return (
    <div className={cn("relative group", className)}>
      <Button
        aria-label="退出私人漫游"
        className={cn(
          "hover:bg-transparent",
          "text-primary hover:text-primary",
        )}
        onClick={() => {
          void setContentSource("queue");
        }}
        size="icon"
        title="退出私人漫游"
        variant="ghost"
      >
        <Icon className="size-5" />
      </Button>
      {/* 纯 CSS tooltip：不依赖 JS 事件，PlayerBar 与播放页均可靠显示 */}
      <span className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 whitespace-nowrap rounded-md border border-border/20 bg-[#2b2b2b] px-3 py-1.5 text-xs text-white opacity-0 shadow-md transition-opacity duration-150 group-hover:opacity-100">
        点击退出私人漫游
      </span>
    </div>
  );
};
