import type { ReactNode } from 'react';
import { formatCount as defaultFormatCount } from '@/shared/utils/format';

interface PlayerTabPanelProps {
  title: string;
  /** 标题后的数量徽标；0 或未传时不显示。 */
  count?: number;
  /** 数量格式化（默认 formatCount；播放列表传 formatQueueCount）。 */
  formatCount?: (count: number) => string;
  /** 标题右侧操作区（如清空播放列表）。 */
  action?: ReactNode;
  children: ReactNode;
}

/**
 * 播放页页签（评论 / 播放列表）统一布局：固定 header + 独立滚动的 body。
 * 滚动条落在 header 之下，两个页签的 header 高度 / 内边距 / 右侧留白完全一致。
 */
export const PlayerTabPanel = ({
  action,
  children,
  count = 0,
  formatCount = defaultFormatCount,
  title,
}: PlayerTabPanelProps) => (
  <div className="h-full w-full flex flex-col pr-4 xl:pr-8">
    <header className="shrink-0 h-12 flex items-center justify-between gap-2 px-2">
      <h2 className="text-sm font-medium truncate">
        {title}
        {count > 0 && (
          <span className="ml-1.5 text-xs text-muted-foreground">
            ({formatCount(count)})
          </span>
        )}
      </h2>
      {action}
    </header>

    <div className="relative flex-1 min-h-0">{children}</div>
  </div>
);

/** 普通（非虚拟）列表页签的滚动容器；虚拟列表自带 Scroller，不套这个。 */
export const PlayerTabBody = ({ children }: { children: ReactNode }) => (
  <div className="relative h-full overflow-y-auto scrollbar-gutter-stable">
    {children}
  </div>
);

/** 页签内居中状态占位（加载中 / 暂无数据）。 */
export const PlayerTabState = ({
  children,
  icon,
}: {
  children?: ReactNode;
  icon?: ReactNode;
}) => (
  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-xs text-muted-foreground">
    {icon}
    {children}
  </div>
);
