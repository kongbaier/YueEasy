import type { HTMLAttributes, ReactNode } from 'react';
import { forwardRef, useImperativeHandle, useRef } from 'react';
import SimpleBar from 'simplebar-react';

interface VirtuosoScrollerProps extends HTMLAttributes<HTMLDivElement> {
  children?: ReactNode;
  /** react-virtuoso 内部注入的 React context，不属于 DOM 属性，丢弃。 */
  context?: unknown;
}

/**
 * react-virtuoso 的 Scroller 组件：把虚拟列表的滚动节点换成 SimpleBar 的内部滚动节点，
 * 使队列列表的滚动条与全应用一致。
 *
 * 关键点：
 * - Virtuoso 需要的是「真正的滚动元素」——它在这一节点上读 `scrollTop`/`scrollHeight`、
 *   调 `scrollTo`、挂 `scroll` 监听，所以 ref 与事件必须落在 `.simplebar-content-wrapper` 上，
 *   而不是 SimpleBar 根节点（根节点不滚动）。
 * - Virtuoso 传入的 style 里带有 `overflow-y: auto` / `position`，那是给原生滚动元素用的，
 *   照搬会重新露出原生滚动条；这里只取尺寸，交给 SimpleBar 根节点。
 * - Virtuoso 的视口是绝对定位，`index.css` 里已把它改回流内布局，否则 SimpleBar
 *   统计不到内容高度、会锁死滚动（详见 index.css 注释）。
 */
export const VirtuosoScroller = forwardRef<
  HTMLDivElement,
  VirtuosoScrollerProps
>(({ children, context: _context, style, ...props }, ref) => {
  const scrollableRef = useRef<HTMLDivElement>(null);

  // Virtuoso 传下来的是它自己的 ref 对象，指向 SimpleBar 的内部滚动节点
  useImperativeHandle(ref, () => scrollableRef.current as HTMLDivElement, []);

  return (
    <SimpleBar
      className="h-full w-full"
      scrollableNodeProps={{ ...props, ref: scrollableRef }}
      style={{ height: style?.height, width: style?.width }}
      // SimpleBar 默认把滚动内容层放进 tab 序列（tabIndex=0）：那会让「整块列表」
      // 变成一个可聚焦控件，键盘焦点停在容器上。键盘滚动由区域焦点导航负责。
      tabIndex={-1}
    >
      {children}
    </SimpleBar>
  );
});

VirtuosoScroller.displayName = 'VirtuosoScroller';
