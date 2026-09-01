import { cn } from '@/shared/utils/cn';
import { Skeleton } from '@/shared/ui/skeleton';
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
  const [current, setCurrent] = useState<string>();
  const [previous, setPrevious] = useState<string>();
  // 镜像 current 状态，供 decode 完成回调读取最新值，避免闭包过期
  const currentSrcRef = useRef<string | undefined>(undefined);

  // 新 src 先离屏预加载并完整解码：首次加载期间展示 shimmer，
  // 切换时保持旧图可见，解码完成后才挂载 <img> 并做交叉淡入淡出，
  // 避免渐进式图片逐行绘制。
  useEffect(() => {
    if (src === currentSrcRef.current) return;

    let cancelled = false;
    const img = new Image();
    img.src = src;

    const markReady = () => {
      if (cancelled) return;
      const prev = currentSrcRef.current;
      if (!reduceMotion && prev !== undefined) {
        setPrevious(prev);
      }
      currentSrcRef.current = src;
      setCurrent(src);
    };

    const decode = (img as HTMLImageElement & { decode?: () => Promise<void> })
      .decode;
    if (typeof decode === 'function') {
      decode.call(img).then(markReady).catch(markReady);
    } else {
      img.addEventListener('load', markReady);
      img.addEventListener('error', markReady);
    }

    return () => {
      cancelled = true;
    };
  }, [src, reduceMotion]);

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
  }, [previous, current, duration, easing, animateOut, animateIn]);

  return (
    <div
      className={cn('relative overflow-hidden size-full', containerClassName)}
    >
      {!current && !previous && (
        <Skeleton className="absolute inset-0 size-full" shimmer />
      )}
      {previous && (
        <img
          key={previous}
          ref={prevNodeRef}
          src={previous}
          {...props}
          className={cn('absolute inset-0 object-cover', className)}
        />
      )}
      {current && (
        <img
          key={current}
          ref={curNodeRef}
          src={current}
          {...props}
          className={cn('absolute inset-0 object-cover', className)}
        />
      )}
    </div>
  );
};
