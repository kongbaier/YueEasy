import { use, useEffect, useRef, useState } from "react";
import { LenisContext } from "@/hooks/useLenis";

const BATCH = 30;
const THRESHOLD = 600;

export function useLoadMore(total: number) {
  const [count, setCount] = useState(() => Math.min(BATCH, total));
  const lenis = use(LenisContext);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    setCount(Math.min(BATCH, total));
  }, [total]);

  useEffect(() => {
    if (!lenis || count >= total) return;

    const onScroll = () => {
      if (rafRef.current) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = 0;
        const maxScroll =
          lenis.dimensions.scrollHeight - lenis.dimensions.height;
        if (maxScroll - lenis.animatedScroll < THRESHOLD) {
          setCount((prev) => Math.min(prev + BATCH, total));
        }
      });
    };

    const unsub = lenis.on("scroll", onScroll);
    return () => {
      unsub();
      cancelAnimationFrame(rafRef.current);
    };
  }, [lenis, count, total]);

  return count;
}
