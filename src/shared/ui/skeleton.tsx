import { cn } from '@/shared/utils/cn';
import React from 'react';

interface SkeletonProps extends React.ComponentProps<'div'> {
  shimmer?: boolean;
}

function Skeleton({ className, shimmer, ...props }: SkeletonProps) {
  return (
    <div
      className={cn(
        'rounded-md bg-muted',
        // shimmer = 伪元素扫光（transform 动画，跑在合成器线程）；
        // 具体结构与动画都在 `bg-shimmer` 里，这里不要再加 `animate-shimmer`。
        shimmer ? 'bg-shimmer' : 'animate-pulse',
        className,
      )}
      data-slot="skeleton"
      {...props}
    />
  );
}

export type { SkeletonProps };
export { Skeleton };
