import { useCallback, useState, type ReactNode } from "react";
import { ScrollContainerContext } from "@/hooks/useScrollContainer";

interface PageScrollerProps {
  children: ReactNode;
}

/**
 * 每个页面独立的滚动容器。
 * 通过 KeepAliveRouteOutlet 的 wrapperComponent 注入，
 * 使 useLoadMore 的 ScrollContainerContext 指向各自页面的滚动容器。
 */
export function PageScroller({ children }: PageScrollerProps) {
  const [scrollContainer, setScrollContainer] = useState<HTMLElement | null>(
    null,
  );
  const scrollRef = useCallback((el: HTMLDivElement | null) => {
    setScrollContainer(el);
  }, []);

  return (
    <ScrollContainerContext.Provider value={scrollContainer}>
      <div
        className="h-full overflow-y-auto [scrollbar-gutter:stable]"
        ref={scrollRef}
      >
        {children}
      </div>
    </ScrollContainerContext.Provider>
  );
}