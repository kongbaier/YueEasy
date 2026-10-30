import { type ComponentRef, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useEffectOnActive } from 'keepalive-for-react';
import type SimpleBar from 'simplebar-react';

/**
 * 路由级滚动位置记忆（策略参照 YesPlayMusic 的 Scrollbar 组件）。
 *
 * 为什么不用 react-router 的 `<ScrollRestoration />`：
 * 1. 它只认 data router（`createBrowserRouter`），本项目用的是 `<BrowserRouter>`，挂上去直接抛
 *    `useScrollRestoration must be used within a data router`；
 * 2. 它只存取 `window` 滚动，而本项目的滚动全部在 `<ScrollArea>`（SimpleBar）内部，window 恒为 0；
 * 3. KeepAlive 切页时会把缓存节点从 DOM 摘下、再 `appendChild` 回来，任何发生在重新挂载之前的
 *    恢复都会被抹掉。
 *
 * 因此采用 YesPlayMusic 的两段式：**滚动时持续记录，重新激活时一次性恢复**。
 * 关键点是「不能在失活时读 scrollTop」——那时节点已被摘出文档（没有布局盒），读到的恒为 0；
 * 只有滚动事件里读到的是有效值。
 *
 * 用法：`const scrollRef = useScrollMemory()`，把 ref 挂到本页的 `<ScrollArea ref={scrollRef}>` 上。
 * 一个路由只登记一个滚动根：key = 实例创建时的 `pathname + search`，与 KeepAlive 的
 * `activeCacheKey`（`keepalive-for-react-router` 内部同款算法）对齐，所以不同 id 的详情页
 * （`/playlist/1` 与 `/playlist/2`）各自独立记忆，互不串味。
 *
 * 注意：key 必须在首次渲染时定死。被缓存的页面在失活后仍然订阅 `useLocation()`，
 * 若每次都重算，key 会漂到当前路由上去。
 */
const positions = new Map<string, number>();
const MAX_ENTRIES = 200;

/** 记一笔位置；超过上限时丢弃最早登记的 key（长会话下防止 Map 无界增长）。 */
function remember(key: string, top: number) {
  if (!positions.has(key) && positions.size >= MAX_ENTRIES) {
    const oldest = positions.keys().next().value;
    if (oldest !== undefined) positions.delete(oldest);
  }
  positions.set(key, top);
}

export function useScrollMemory() {
  const { pathname, search } = useLocation();
  // lazy initial state：只取首帧地址，之后不再跟随全局路由变化。
  const [key] = useState(() => pathname + search);

  const areaRef = useRef<ComponentRef<typeof SimpleBar>>(null);

  useEffectOnActive(() => {
    const el = areaRef.current?.getScrollElement();
    if (!el) return;

    const saved = positions.get(key);
    if (saved) el.scrollTop = saved;

    // 复核一次：缓存节点刚被 append 回来时（或页面仍在首帧渲染）这次赋值可能被吞掉，
    // 下一帧若仍是 0 且内容确实可滚，则补写。仅在 saved > 0 时复核，避免覆盖用户此刻的滚动。
    const raf = saved
      ? requestAnimationFrame(() => {
          if (el.scrollTop === 0 && el.scrollHeight > el.clientHeight) {
            el.scrollTop = saved;
          }
        })
      : 0;

    const handleScroll = () => remember(key, el.scrollTop);
    el.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      if (raf) cancelAnimationFrame(raf);
      el.removeEventListener('scroll', handleScroll);
    };
  }, []);

  return areaRef;
}
