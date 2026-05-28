import Lenis from "lenis";
import type { RefObject } from "react";
import { useEffect, useRef, useState } from "react";

export function useLenis(
  wrapperRef: RefObject<HTMLDivElement | null>,
  contentRef: RefObject<HTMLDivElement | null>,
) {
  const lenisRef = useRef<Lenis | null>(null);
  const [ready, setReady] = useState(false);

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

    return () => {
      lenis.destroy();
      lenisRef.current = null;
      setReady(false);
    };
  }, [wrapperRef, contentRef]);

  return { lenisRef, ready };
}
