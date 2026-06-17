import { useEffectOnActive } from "keepalive-for-react";
import type { ReactNode } from "react";
import { useCallback, useRef, useState } from "react";
import { ScrollContainerContext } from "@/hooks/useScrollContainer";

interface PageScrollerProps {
  children: ReactNode;
}

/**
 * 每个页面独立的滚动容器。
 * 通过 KeepAliveRouteOutlet 的 wrapperComponent 注入，
 * 使 useLoadMore 的 ScrollContainerContext 指向各自页面的滚动容器。
 *
 * KeepAlive 缓存切换时 detach/reattach DOM，浏览器会重置 scrollTop。
 * 持续追踪滚动位置并在激活时恢复。
 */
export function PageScroller({ children }: PageScrollerProps) {
  const [scrollContainer, setScrollContainer] = useState<HTMLElement | null>(
    null,
  );
  const savedTop = useRef(0);
  const scrollRef = useCallback((el: HTMLDivElement | null) => {
    setScrollContainer(el);
  }, []);

  // 持续追踪滚动位置，确保 detach 时已有最新值
  const handleScroll = useCallback(() => {
    if (scrollContainer) {
      savedTop.current = scrollContainer.scrollTop;
    }
  }, [scrollContainer]);

  // 页面激活时恢复滚动位置（延迟到浏览器 layout 完成后）
  useEffectOnActive(() => {
    const el = scrollContainer;
    if (!el) return;
    requestAnimationFrame(() => {
      el.scrollTop = savedTop.current;
    });
  }, [scrollContainer]);

  return (
    <ScrollContainerContext.Provider value={scrollContainer}>
      <div
        className="h-full overflow-y-auto scrollbar-gutter-stable"
        onScroll={handleScroll}
        ref={scrollRef}
      >
        {children}
      </div>
    </ScrollContainerContext.Provider>
  );
}
