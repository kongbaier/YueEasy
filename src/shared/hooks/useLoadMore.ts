import { createContext, use, useEffect, useRef, useState } from 'react';

export const ScrollContainerContext = createContext<HTMLElement | null>(null);

const BATCH = 30;
const THRESHOLD = 600;

export const useLoadMore = (total: number) => {
  const [loadedCount, setLoadedCount] = useState(BATCH);
  const container = use(ScrollContainerContext);
  const rafRef = useRef<number>(0);

  const count = Math.min(loadedCount, total);

  useEffect(() => {
    if (!container || count >= total) return;

    const onScroll = () => {
      if (rafRef.current) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = 0;
        const maxScroll = container.scrollHeight - container.clientHeight;
        if (maxScroll - container.scrollTop < THRESHOLD) {
          setLoadedCount((prev) => Math.min(prev + BATCH, total));
        }
      });
    };

    container.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      container.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(rafRef.current);
    };
  }, [container, count, total]);

  return count;
};
