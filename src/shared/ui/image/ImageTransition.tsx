import { cn } from '@/shared/lib/utils';
import { useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';

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

interface ImageTransitionProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  containerClassName?: string;
  duration?: number;
  easing?: string;
  /** 控制反转：调用方自定义"离场动画"，默认淡出 */
  animateOut?: (el: HTMLElement, opts: KeyframeAnimationOptions) => Animation;
  /** 控制反转：调用方自定义"进场动画"，默认淡入 */
  animateIn?: (el: HTMLElement, opts: KeyframeAnimationOptions) => Animation;
}

export const ImageTransition = ({
  src,
  containerClassName,
  className,
  duration = 200,
  easing = 'ease-out',
  animateOut = defaultAnimateOut,
  animateIn = defaultAnimateIn,
  ...props
}: ImageTransitionProps) => {
  const reduceMotion = usePrefersReducedMotion();
  const [current, setCurrent] = useState(src);
  const [previous, setPrevious] = useState<string>();

  if (src !== current) {
    if (reduceMotion) {
      setCurrent(src);
    } else {
      setPrevious(current);
      setCurrent(src);
    }
  }

  const previousRef = useRef<HTMLImageElement>(null);
  const currentRef = useRef<HTMLImageElement>(null);

  useLayoutEffect(() => {
    if (!previous) return;

    const prevNode = previousRef.current;
    const curNode = currentRef.current;
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
      {previous && (
        <img
          key={previous}
          ref={previousRef}
          src={previous}
          {...props}
          className={cn('absolute inset-0 object-cover', className)}
        />
      )}
      <img
        key={current}
        ref={currentRef}
        src={current}
        {...props}
        className={cn('absolute inset-0 object-cover', className)}
      />
    </div>
  );
};
