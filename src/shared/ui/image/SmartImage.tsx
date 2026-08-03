import { cn } from '@/shared/lib/utils';
import { Skeleton } from '@/shared/ui/skeleton';
import { useEffect, useState } from 'react';

interface SmartImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  /** 加载中占位内容，默认 shimmer 骨架 */
  placeholder?: React.ReactNode;
  /** 包裹容器类名：相对定位 + 尺寸 + 圆角等 */
  containerClassName?: string;
  /** 加载中是否使用 shimmer（false 时退化为普通骨架） */
  shimmer?: boolean;
  /** 解码/加载失败时仍回退显示原图，避免永久骨架（默认 true） */
  fallbackOnError?: boolean;
}

/**
 * 先离屏预加载并完整解码，再挂载 <img>。
 *
 * 浏览器对渐进式图片（progressive JPEG / 交错 PNG）会在数据流到达时逐行渲染，
 * 出现"从上往下先显示一半"的观感。本组件通过 `new Image()` + `decode()` 等到
 * 整张图解码完毕才替换占位骨架，保证图片一次性完整出现。
 */
export const SmartImage = ({
  src,
  className,
  containerClassName,
  placeholder,
  shimmer = true,
  fallbackOnError = true,
  ...props
}: SmartImageProps) => {
  const [loadedSrc, setLoadedSrc] = useState<string>();

  useEffect(() => {
    let cancelled = false;

    const img = new Image();
    img.src = src;

    const markLoaded = () => {
      if (cancelled) return;
      setLoadedSrc(src);
    };
    const markLoadedAnyway = () => {
      if (cancelled) return;
      if (fallbackOnError) markLoaded();
    };

    // decode() 在图片可安全绘制（完整解码）后才 resolve，
    // 提前于 load 事件，能杜绝渐进式局部绘制。
    const decode = (img as HTMLImageElement & { decode?: () => Promise<void> })
      .decode;
    if (typeof decode === 'function') {
      decode.call(img).then(markLoaded).catch(markLoadedAnyway);
    } else {
      img.addEventListener('load', markLoaded);
      img.addEventListener('error', markLoadedAnyway);
    }

    return () => {
      cancelled = true;
    };
  }, [src, fallbackOnError]);

  return (
    <div className={cn('relative overflow-hidden', containerClassName)}>
      {!loadedSrc &&
        (placeholder ?? (
          <Skeleton className="absolute inset-0 size-full" shimmer={shimmer} />
        ))}
      {loadedSrc && (
        <img
          alt=""
          className={cn('size-full object-cover', className)}
          src={loadedSrc}
          {...props}
        />
      )}
    </div>
  );
};
