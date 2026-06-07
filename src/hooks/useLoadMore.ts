import { use, useEffect, useRef, useState } from "react";
import { ScrollContainerContext } from "@/hooks/useScrollContainer";

const BATCH = 30;
const THRESHOLD = 600;

export function useLoadMore(total: number) {
  const [count, setCount] = useState(() => Math.min(BATCH, total));
  const container = use(ScrollContainerContext);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    setCount(Math.min(BATCH, total));
  }, [total]);

  useEffect(() => {
    if (!container || count >= total) return;

    const onScroll = () => {
      if (rafRef.current) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = 0;
        const maxScroll = container.scrollHeight - container.clientHeight;
        if (maxScroll - container.scrollTop < THRESHOLD) {
          setCount((prev) => Math.min(prev + BATCH, total));
        }
      });
    };

    container.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      container.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(rafRef.current);
    };
  }, [container, count, total]);

  return count;
}
