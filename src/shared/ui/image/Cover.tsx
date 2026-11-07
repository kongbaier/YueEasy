import { CrossfadeImage } from './CrossfadeImage';
import { useDecodedSrc } from '@/shared/hooks/useDecodedSrc';
import { cn } from '@/shared/utils/cn';

/**
 * 光晕滤镜唯一 id：由 CoverGlowDefs 在应用根挂载一次，所有 Cover 共享引用，
 * 避免每个实例都复制一份相同的 SVG <defs>。
 */
const COVER_GLOW_FILTER_ID = 'cover-glow';

/**
 * 应用根挂载一次的共享滤镜定义 —— **只做模糊，不合并源图**。
 *
 * 早先这一层是套在「封面 + CrossfadeImage」外层的：滤镜的输入每帧都在变
 * （交叉淡出是逐帧改 opacity），于是 0.2s 的换源淡出期间要重跑 12 次全尺寸高斯模糊；
 * 骨架占位符在滤镜里闪光时更是每帧重跑一次。现在滤镜只作用于**静态光晕副本**
 * （见 `CoverGlow`），每次换源只在解码完成时算一次；封面本体则在普通合成层里做 opacity 淡出。
 *
 * 因为源图由 CrossfadeImage 自己画在最上层，这里不需要 `feMerge` 把源图合回来
 * （合回来反而会在淡出期间让新图以不透明度 1 透出、破坏换源淡出的语义）。
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
      </filter>
    </defs>
  </svg>
);

interface CoverGlowProps {
  src: string;
  /** 与封面本体同一份前景类名：圆角/边框/阴影必须一致，否则光晕轮廓对不上封面 */
  className?: string;
}

/**
 * 静态光晕层：只画「模糊后的封面」，留在封面本体下面。
 *
 * 两个关键约束：
 * 1. 走与 CrossfadeImage 同一个解码状态机 —— 新图**完整解码后**才换，
 *    否则未解码的渐进图会抢先出现在光晕里（模糊遮得住一半，但换源时仍然会闪）。
 * 2. 解码出来之前整层不渲染，避免一块空的滤镜表面（每次换源都要白分配一次离屏）。
 */
const CoverGlow = ({ src, className }: CoverGlowProps) => {
  const { decodedSrc } = useDecodedSrc<HTMLDivElement>(src);
  if (!decodedSrc) return null;

  return (
    <div
      aria-hidden
      className="absolute inset-0"
      style={{ filter: `url(#${COVER_GLOW_FILTER_ID})` }}
    >
      <img
        alt=""
        className={cn('size-full object-cover', className)}
        src={decodedSrc}
      />
    </div>
  );
};

interface CoverProps {
  src: string | undefined;
  alt: string;
  className?: string;
  foregroundClassName?: string;
}

/**
 * 封面：CrossfadeImage（换源交叉淡出）+ 静态光晕的组合体。
 * 需要「换源淡出但不要光晕」的场景直接用 CrossfadeImage，不要在这里加开关。
 *
 * 层级顺序（DOM 序 = 绘制序，两者都是定位元素）：光晕层在下、封面本体在上。
 * 两份都拿 `foregroundClassName`：圆角（含 `rounded-full` 的头像）必须一致，否则光晕会
 * 从方角里溢出来；边框/阴影重复画也没关系 —— 光晕那份会被模糊掉，而本体那份才是
 * 看得见的（顺带好处：封面阴影从「被滤镜模糊的软影」变成了图层自带的清晰阴影）。
 */
export const Cover = ({
  src,
  alt,
  className,
  foregroundClassName,
}: CoverProps) => {
  return (
    <div className={cn('relative', className)}>
      {src && (
        <>
          <CoverGlow className={foregroundClassName} src={src} />
          <CrossfadeImage
            alt={alt}
            containerClassName={cn('size-full', foregroundClassName)}
            src={src}
          />
        </>
      )}
    </div>
  );
};
