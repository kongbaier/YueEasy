import * as React from 'react';

/**
 * 监听容器元素宽度（ResizeObserver），返回当前内容宽度（px）。
 * 用于"按容器宽度而非视口宽度"的响应式判断，与 CSS 容器查询（@container）配合。
 */
export function useContainerWidth<T extends HTMLElement>(
  ref: React.RefObject<T | null>,
): number {
  const [width, setWidth] = React.useState(0);

  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    // 首帧同步读取，避免 ResizeObserver 异步首报之前的闪动
    setWidth(el.getBoundingClientRect().width);

    const observer = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w !== undefined) setWidth(w);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);

  return width;
}
