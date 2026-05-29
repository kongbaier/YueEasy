import Lenis from "lenis";
import type { RefObject } from "react";
import { useCallback, useEffect, useRef, useState } from "react";

export function useLenis(
  wrapperRef: RefObject<HTMLDivElement | null>,
  contentRef: RefObject<HTMLDivElement | null>,
) {
  const lenisRef = useRef<Lenis | null>(null);
  const [ready, setReady] = useState(false);
  const [resizeVersion, setResizeVersion] = useState(0);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    const content = contentRef.current;
    if (!wrapper || !content) return;

    const lenis = new Lenis({
      wrapper,
      content,
      autoRaf: true,
      smoothWheel: true,
      lerp: 0.15,
    });

    lenisRef.current = lenis;
    setReady(true);

    const observer = new ResizeObserver(() => {
      lenis.resize();
      setResizeVersion((v) => v + 1);
    });
    observer.observe(content);

    return () => {
      observer.disconnect();
      lenis.destroy();
      lenisRef.current = null;
      setReady(false);
    };
  }, [wrapperRef, contentRef]);

  const resize = useCallback(() => {
    lenisRef.current?.resize();
    setResizeVersion((v) => v + 1);
  }, []);

  const scrollToTop = useCallback(() => {
    lenisRef.current?.scrollTo(0, { immediate: true });
  }, []);

  return { lenisRef, ready, resizeVersion, resize, scrollToTop };
}
