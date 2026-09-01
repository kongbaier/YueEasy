import { CrossfadeImage } from './CrossfadeImage';
import { cn } from '@/shared/utils/cn';

/**
 * 光晕滤镜唯一 id：由 CoverGlowDefs 在应用根挂载一次，所有 Cover 共享引用，
 * 避免每个实例都复制一份相同的 SVG <defs>。
 */
const COVER_GLOW_FILTER_ID = 'cover-glow';

/**
 * 应用根挂载一次的共享滤镜定义。SVG 光晕（feGaussianBlur + 半透明合并）作用于根容器，
 * 跟随 CrossfadeImage 的过渡。渲染为 0 尺寸、不影响布局。
 */
export const CoverGlowDefs = () => (
  <svg style={{ position: 'absolute', width: 0, height: 0 }}>
    <defs>
      <filter id={COVER_GLOW_FILTER_ID} x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="8" result="blur" />
        <feComponentTransfer>
          <feFuncA type="linear" slope="0.6" />
        </feComponentTransfer>
        <feMerge>
          <feMergeNode />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
  </svg>
);

interface CoverProps {
  src: string | undefined;
  alt: string;
  className?: string;
  foregroundClassName?: string;
}

/**
 * 封面：CrossfadeImage（换源交叉淡出）+ 光晕滤镜的组合体。
 * 需要「换源淡出但不要光晕」的场景直接用 CrossfadeImage，不要在这里加开关。
 */
export const Cover = ({
  src,
  alt,
  className,
  foregroundClassName,
}: CoverProps) => {
  return (
    <div
      className={cn('isolate relative', className)}
      style={src ? { filter: `url(#${COVER_GLOW_FILTER_ID})` } : undefined}
    >
      {src && (
        <CrossfadeImage
          alt={alt}
          containerClassName={cn('size-full', foregroundClassName)}
          src={src}
        />
      )}
    </div>
  );
};
