import type { ReactNode } from 'react';
import { Skeleton } from '@/shared/ui/skeleton';
import { cn } from '@/shared/utils/cn';

interface ImagePlaceholderProps {
  /** 加载中是否使用 shimmer（false 时退化为普通骨架） */
  shimmer?: boolean;
  className?: string;
  /**
   * 自定义占位内容：
   * - 缺省（undefined）= 默认 shimmer 骨架
   * - `null` = 不渲染占位（调用方已在容器层铺好骨架，避免双骨架叠加）
   */
  children?: ReactNode;
}

/**
 * 图片「解码期」占位呈现。
 *
 * 请求期骨架与解码期骨架共用本组件 ⇒ 两段 loading 在视觉上是**连续的一段 shimmer**，
 * 而不是两个各自定义样式、各自演化的骨架。
 */
export const ImagePlaceholder = ({
  shimmer = true,
  className,
  children,
}: ImagePlaceholderProps) => {
  if (children !== undefined) return <>{children}</>;
  return (
    <Skeleton
      className={cn('absolute inset-0 size-full', className)}
      shimmer={shimmer}
    />
  );
};
