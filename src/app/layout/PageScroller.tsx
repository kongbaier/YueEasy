import { useEffectOnActive } from 'keepalive-for-react';
import type { ReactNode } from 'react';
import { useCallback, useRef } from 'react';
import type SimpleBar from 'simplebar-react';
import { ScrollArea } from '@/shared/ui/scroll-area';

interface PageScrollerProps {
  children: ReactNode;
}

type SimpleBarInstance = NonNullable<React.ComponentRef<typeof SimpleBar>>;

/**
 * 每个页面独立的滚动容器，作为 KeepAliveRouteOutlet 的 wrapperComponent 注入。
 *
 * KeepAlive 缓存切换时会把缓存节点从 DOM 上摘下来再挂回去（keepalive-for-react 用
 * appendChild 搬移 `keepalive-cache-div`），浏览器在这次搬移中会把 scrollTop 归零。
 * 所以离开页面时记下位置，重新激活时恢复——与迁移前同一个理由。
 */
export function PageScroller({ children }: PageScrollerProps) {
  const savedTop = useRef(0);
  const simpleBar = useRef<SimpleBarInstance | null>(null);

  const setSimpleBarRef = useCallback((instance: SimpleBarInstance | null) => {
    simpleBar.current = instance;
  }, []);

  useEffectOnActive(() => {
    // SimpleBar 真正的滚动节点是内部的 content-wrapper，根节点不滚动
    const el = simpleBar.current?.getScrollElement();
    if (!el) return;

    // 延迟到浏览器 layout 完成后恢复
    requestAnimationFrame(() => {
      el.scrollTop = savedTop.current;
    });

    // 离开页面（节点仍挂在 DOM 上）时记录位置；已被摘下的节点读不到有效值，跳过
    return () => {
      if (el.isConnected) savedTop.current = el.scrollTop;
    };
  }, []);

  return (
    <ScrollArea className="h-full w-full" ref={setSimpleBarRef}>
      {children}
    </ScrollArea>
  );
}
