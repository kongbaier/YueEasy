import { cn } from '@/shared/utils/cn';
import { useDecodedSrc } from '@/shared/hooks/useDecodedSrc';
import { ImagePlaceholder } from './ImagePlaceholder';

interface DecodedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  /**
   * 解码期占位内容。缺省 = shimmer 骨架；传 null 表示不渲染占位
   * （调用方已在容器层铺好骨架，避免双骨架叠加）。
   */
  placeholder?: React.ReactNode;
  /** 包裹容器类名：相对定位 + 尺寸 + 圆角等 */
  containerClassName?: string;
  /** 加载中是否使用 shimmer（false 时退化为普通骨架） */
  shimmer?: boolean;
  /** 解码/加载失败时仍回退显示原图，避免永久骨架（默认 true） */
  fallbackOnError?: boolean;
  /**
   * 延迟到进入视口附近（含轮播相邻 slide）才开始预加载+解码。
   * 默认 false：挂载即解码。轮播等大量离屏图片传 true，避免全部 slide
   * 同时解码、白白占用 GPU 纹理；渲染的 <img> 也会带上 loading="lazy"。
   */
  lazy?: boolean;
}

/**
 * 先离屏预加载并完整解码，再挂载 <img>。
 *
 * 解码状态机在 `useDecodedSrc`（与 CrossfadeImage 共用）；本组件只负责
 * 「解码期显示 ImagePlaceholder，就绪后原地替换成 <img>」这一种呈现方式。
 * 换源时保留旧图直到新图解码完成，不会闪回骨架；需要交叉淡出请用 CrossfadeImage。
 *
 * lazy 模式下用 IntersectionObserver 延后触发预加载，离屏 slide 不浪费纹理。
 */
export const DecodedImage = ({
  src,
  className,
  containerClassName,
  placeholder,
  shimmer = true,
  fallbackOnError = true,
  lazy = false,
  ...props
}: DecodedImageProps) => {
  const { ref, decodedSrc } = useDecodedSrc<HTMLDivElement>(src, {
    lazy,
    fallbackOnError,
  });

  return (
    <div
      ref={ref}
      className={cn('relative overflow-hidden', containerClassName)}
    >
      {!decodedSrc && (
        <ImagePlaceholder shimmer={shimmer}>{placeholder}</ImagePlaceholder>
      )}
      {decodedSrc && (
        <img
          alt=""
          className={cn('size-full object-cover', className)}
          src={decodedSrc}
          {...props}
          loading={lazy ? 'lazy' : props.loading}
        />
      )}
    </div>
  );
};
