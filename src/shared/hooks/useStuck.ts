import { use, useEffect, useRef, useState } from 'react';
import { ScrollContainerContext } from './useLoadMore';

/**
 * 检测 `position: sticky` 元素是否已吸附在滚动容器顶部（stuck）。
 *
 * 原理：在粘性元素紧邻前方放一个 1px 哨兵（sentinel），用 IntersectionObserver 观察它。
 * 元素吸附时哨兵被滚出容器顶部 → 不相交 → `isStuck` 为 true。
 * root 取页面滚动容器（`ScrollContainerContext`，即 PageScroller），无容器时退回视口，
 * 因此依赖的是容器而不是 window，KeepAlive 切换页面也能正确工作。
 *
 * 用法：把 `sentinelRef` 挂在紧贴粘性元素之前的 1px 元素上，用 `isStuck` 切换样式：
 * ```tsx
 * const { sentinelRef, isStuck } = useStuck();
 * return (
 *   <>
 *     <div aria-hidden className="h-px -mb-px" ref={sentinelRef} />
 *     <div className={cn('sticky top-0 z-10', isStuck ? 'bg-card' : 'bg-transparent')} />
 *   </>
 * );
 * ```
 */
export function useStuck() {
  const container = use(ScrollContainerContext);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [isStuck, setIsStuck] = useState(false);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      ([entry]) => setIsStuck(!entry.isIntersecting),
      { root: container ?? null, threshold: 0 },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [container]);

  return { sentinelRef, isStuck };
}
