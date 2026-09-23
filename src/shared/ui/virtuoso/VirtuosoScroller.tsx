import type { HTMLAttributes } from 'react';
import { forwardRef } from 'react';

export const VirtuosoScroller = forwardRef<
  HTMLDivElement,
  HTMLAttributes<HTMLDivElement>
>((props, ref) => (
  <div
    {...props}
    ref={ref}
    style={{
      ...props.style,
      height: '100%',
      overflow: 'auto',
      // 预留滚动条槽位：列表长度变化出现/消失滚动条时内容不抖动
      scrollbarGutter: 'stable',
    }}
  />
));

VirtuosoScroller.displayName = 'VirtuosoScroller';
