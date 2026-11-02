import type { ReactNode } from 'react';
import { Button } from './button';
import { cn } from '@/shared/utils/cn';

export interface TabBarItem<K extends string> {
  key: K;
  label: ReactNode;
  /** 右上角小角标（如歌曲数 / 评论数）；无需展示时不传。 */
  badge?: ReactNode;
}

interface TabBarProps<K extends string> {
  items: readonly TabBarItem<K>[];
  active: K;
  onChange: (key: K) => void;
  className?: string;
}

/**
 * 详情页通用分类切换条（下划线指示器）。
 *
 * 歌单 / 专辑 / 歌手 / 用户主页共用同一套视觉：文字 + 悬停变亮 + 选中下划线，
 * 计数角标由调用方决定是否传入（评论数 0 时不显示这类判断留在调用方）。
 */
export function TabBar<K extends string>({
  items,
  active,
  onChange,
  className,
}: TabBarProps<K>) {
  return (
    <div
      className={cn('flex space-x-4 border-b border-border/40', className)}
      data-focus-zone
    >
      {items.map((item) => (
        <Button
          className={cn(
            'px-0 text-[17px] font-medium transition-colors',
            active === item.key
              ? 'text-foreground font-medium'
              : 'text-muted-foreground hover:text-foreground/80',
          )}
          key={item.key}
          onClick={() => onChange(item.key)}
          variant="ghost"
        >
          <span className="flex items-start gap-1">
            <span className="relative leading-none">
              {item.label}
              {active === item.key && (
                <span className="absolute left-1/2 -translate-x-1/2 -bottom-1.75 w-5 h-0.5 bg-primary rounded-full" />
              )}
            </span>
            {item.badge != null && (
              <span className="text-[9px] leading-none tabular-nums text-muted-foreground/70">
                {item.badge}
              </span>
            )}
          </span>
        </Button>
      ))}
    </div>
  );
}
