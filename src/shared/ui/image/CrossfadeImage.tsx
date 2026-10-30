import { cn } from '@/shared/utils/cn';
import { useDecodedSrc } from '@/shared/hooks/useDecodedSrc';
import { ImagePlaceholder } from './ImagePlaceholder';
import {
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';

function subscribe(callback: () => void) {
  const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
  mql.addEventListener('change', callback);
  return () => mql.removeEventListener('change', callback);
}
function getSnapshot() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
function getServerSnapshot() {
  return false;
}
function usePrefersReducedMotion() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

const defaultAnimateOut = (el: HTMLElement, opts: KeyframeAnimationOptions) =>
  el.animate([{ opacity: 1 }, { opacity: 0 }], opts);

const defaultAnimateIn = (el: HTMLElement, opts: KeyframeAnimationOptions) =>
  el.animate([{ opacity: 0 }, { opacity: 1 }], opts);

/**
 * 交叉淡出的两层共用定位：
 * - `size-full` 必需：`inset-0` 对**替换元素**不拉伸（图片按内在尺寸停在左上角）
 * - 只需 `left/top`：w/h 已确定，`right/bottom` 属于 over-constrained 会被浏览器丢弃
 */
const LAYER_CLASS = 'absolute left-0 top-0 size-full object-cover';

interface CrossfadeImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  containerClassName?: string;
  duration?: number;
  easing?: string;
  /** 控制反转：调用方自定义"离场动画"，默认淡出 */
  animateOut?: (el: HTMLElement, opts: KeyframeAnimationOptions) => Animation;
  /** 控制反转：调用方自定义"进场动画"，默认淡入 */
  animateIn?: (el: HTMLElement, opts: KeyframeAnimationOptions) => Animation;
}

/**
 * 换源交叉淡出：首次加载显示 ImagePlaceholder，切换时保持旧图可见，
 * 新图完整解码后才挂载并淡入淡出（避免渐进式图片逐行绘制 + 换源空窗）。
 *
 * 解码状态机在 `useDecodedSrc`（与 DecodedImage 共用），本组件只负责相位编排与动画。
 *
 * 两条硬约束：
 * 1. `<img>` 必须满填充（`size-full`）：`inset-0` 对**替换元素**不会拉伸，
 *    `width/height:auto` 走内在尺寸（CSS 2.1 §10.3.8），小图因此停在左上角不铺满。
 * 2. `current`/`previous` 必须在**渲染期**同步推进（React「render 中调整 state」）：
 *    若放在 effect 里推进，新图会先独占一帧提交（旧图已卸载）再回头做交叉淡出，
 *    表现为「新图闪一下 → 旧图闪回来 → 才淡入」。
 */
export const CrossfadeImage = ({
  src,
  containerClassName,
  className,
  duration = 200,
  easing = 'ease-out',
  animateOut = defaultAnimateOut,
  animateIn = defaultAnimateIn,
  ...props
}: CrossfadeImageProps) => {
  const reduceMotion = usePrefersReducedMotion();
  const { ref: containerRef, decodedSrc } = useDecodedSrc<HTMLDivElement>(src);

  // 已提交到 DOM 的 { 当前图, 离场图 }：两者必须在同一次提交里挂载
  const [frames, setFrames] = useState<{
    current?: string;
    previous?: string;
  }>({});

  // 新图就绪 → 同一次提交内挂上旧图（prefers-reduced-motion 时直接切换，不排离场）
  if (decodedSrc !== frames.current) {
    setFrames({
      current: decodedSrc,
      previous: reduceMotion ? undefined : frames.current,
    });
  }
  const { current, previous } = frames;

  const prevNodeRef = useRef<HTMLImageElement>(null);
  const curNodeRef = useRef<HTMLImageElement>(null);

  useLayoutEffect(() => {
    if (!previous) return;

    const prevNode = prevNodeRef.current;
    const curNode = curNodeRef.current;
    if (!prevNode || !curNode) return;

    const opts: KeyframeAnimationOptions = {
      duration,
      easing,
      fill: 'forwards',
    };

    const outAnim = animateOut(prevNode, opts);
    const inAnim = animateIn(curNode, opts);

    let cancelled = false;

    // 离场动画结束 → 卸载旧图（cancelled 时 finished 会 reject，交白卷即可）
    const settle = () => {
      if (cancelled) return;
      setFrames((f) => (f.previous === previous ? { current: f.current } : f));
    };

    void outAnim.finished.then(settle, () => {});

    const fallback = setTimeout(settle, duration + 100);

    return () => {
      cancelled = true;
      clearTimeout(fallback);
      outAnim.cancel();
      inAnim.cancel();
    };
  }, [previous, duration, easing, animateOut, animateIn]);

  return (
    <div
      ref={containerRef}
      className={cn('relative overflow-hidden size-full', containerClassName)}
    >
      {!current && <ImagePlaceholder />}
      {previous && (
        <img
          key={previous}
          ref={prevNodeRef}
          src={previous}
          {...props}
          className={cn(LAYER_CLASS, className)}
        />
      )}
      {current && (
        <img
          key={current}
          ref={curNodeRef}
          src={current}
          {...props}
          className={cn(LAYER_CLASS, className)}
        />
      )}
    </div>
  );
};
