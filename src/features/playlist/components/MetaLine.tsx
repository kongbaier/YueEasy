import type { ReactNode } from 'react';
import { cn } from '@/shared/utils/cn';

export interface MetaItem {
  key: string;
  node: ReactNode;
  ext?: ReactNode;
}

interface MetaLineProps {
  items: (MetaItem | false | null | undefined)[];
  className?: string;
}

/**
 * 详情头部元信息行：数据部分用 MetaValue 强调，标签文字继承 muted 色。
 * 保持 <p> + inline 子元素（不要改成 flex），否则 truncate 的省略号会失效。
 */
export const MetaLine = ({ items, className }: MetaLineProps) => {
  const visible = items.filter((item): item is MetaItem => Boolean(item));
  if (visible.length === 0) return null;

  return (
    <p className={cn('truncate text-sm text-muted-foreground/80', className)}>
      {visible.map((item, i) => (
        <span key={item.key}>
          {i > 0 && (
            <span className="mx-2 text-muted-foreground/30 select-none">·</span>
          )}
          <span className="text-primary tabular-nums">{item.node}</span>
          {item.ext}
        </span>
      ))}
    </p>
  );
};
