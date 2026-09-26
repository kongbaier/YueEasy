import { cn } from '@/shared/utils/cn';
import { useDecodedSrc } from '@/shared/hooks/useDecodedSrc';
import { ImagePlaceholder } from './ImagePlaceholder';
import {
  useEffect,
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

  const [previous, setPrevious] = useState<string>();
  // 镜像已落位的 src，供 decodedSrc 更新回调读取，避免闭包过期
  const settledRef = useRef<string | undefined>(undefined);

  // 新图就绪 → 旧图转入离场队列；prefers-reduced-motion 时直接切换
  useEffect(() => {
    if (!decodedSrc || decodedSrc === settledRef.current) return;
    const prev = settledRef.current;
    settledRef.current = decodedSrc;
    setPrevious(reduceMotion ? undefined : prev);
  }, [decodedSrc, reduceMotion]);

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

    outAnim.finished.then(() => {
      if (cancelled) return;
      setPrevious(undefined);
    });

    const fallback = setTimeout(() => {
      if (!cancelled) setPrevious(undefined);
    }, duration + 100);

    return () => {
      cancelled = true;
      clearTimeout(fallback);
      outAnim.cancel();
      inAnim.cancel();
    };
  }, [previous, decodedSrc, duration, easing, animateOut, animateIn]);

  return (
    <div
      ref={containerRef}
      className={cn('relative overflow-hidden size-full', containerClassName)}
    >
      {!decodedSrc && <ImagePlaceholder />}
      {previous && (
        <img
          key={previous}
          ref={prevNodeRef}
          src={previous}
          {...props}
          className={cn('absolute inset-0 object-cover', className)}
        />
      )}
      {decodedSrc && (
        <img
          key={decodedSrc}
          ref={curNodeRef}
          src={decodedSrc}
          {...props}
          className={cn('absolute inset-0 object-cover', className)}
        />
      )}
    </div>
  );
};
