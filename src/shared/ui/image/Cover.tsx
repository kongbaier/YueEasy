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
 *
 * 滤镜区域（x/y/width/height）必须贴着 `stdDeviation` 收紧：滤镜区域决定**离屏表面的像素面积**，
 * 200%×200% 就是元素面积的 4 倍（播放页 448px 封面在 DPR 2 下 ≈ 1792² ≈ 12.8MB 一张），
 * 而 gaussian 在 3σ（=24px）之外已经衰减到不可见 —— 留 20% 边（1.96 倍面积、192px 封面上仍有
 * 38px = 3σ 边距）视觉完全一致，滤镜表面的像素量直接砍半。
 */
export const CoverGlowDefs = () => (
  <svg style={{ position: 'absolute', width: 0, height: 0 }}>
    <defs>
      <filter
        height="140%"
        id={COVER_GLOW_FILTER_ID}
        width="140%"
        x="-20%"
        y="-20%"
      >
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
    // 不写 `isolate`/`relative`：非 none 的 filter 本身就会建 stacking context 与
    // containing block（无片源时本层本来也是空的）；子层 CrossfadeImage 自带 `relative`。
    <div
      className={className}
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
