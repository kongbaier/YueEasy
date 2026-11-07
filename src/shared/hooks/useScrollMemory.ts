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

    /**
     * 恢复态：目标位置在「内容还没长够」时会被 clamp（浏览器把 scrollTop 钳到最大可滚值）。
     * 两处会遇到：
     * - 缓存节点刚 append 回来、首帧布局未完成（既有场景，靠下一帧复核）；
     * - 列表渐进挂载（`shared/components/track/TrackList`）：尾部的行还没挂上，
     *   scrollHeight 只有首个分块那么高，滚回深层位置的用户会被悄悄拽到分块末尾。
     * 因此恢复期间观察内容尺寸，长高就把目标再写一次，直到到达或超时。
     * 期间**不记录**滚动位置（否则记下的是被 clamp 的中间值，真实位置就丢了）。
     */
    const restoreTarget = saved ?? 0;
    let restoring = restoreTarget > 0;
    let observer: ResizeObserver | undefined;
    let timeout: ReturnType<typeof setTimeout> | undefined;

    const stopRestoring = () => {
      restoring = false;
      observer?.disconnect();
      if (timeout) clearTimeout(timeout);
    };

    const restore = () => {
      if (!restoring) return;
      el.scrollTop = restoreTarget;
      if (el.scrollTop >= restoreTarget) stopRestoring();
    };

    if (restoring) {
      restore();
      if (restoring) {
        const content = el.firstElementChild;
        if (content) {
          // 内容长高（新分块挂上 / 图片布局完成）就再试一次
          observer = new ResizeObserver(restore);
          observer.observe(content);
        }
        // 兜底：最多补写 2s，之后把滚动所有权交回用户
        timeout = setTimeout(stopRestoring, 2000);
      }
    }

    // 首帧复核：缓存节点刚被 append 回来时上一次赋值可能被吞掉
    const raf = restoring
      ? requestAnimationFrame(() => {
          if (restoring && el.scrollTop === 0) restore();
        })
      : 0;

    // 用户自己动了滚轮 / 按下指针 → 立刻放弃回填（不跟用户抢滚动）
    const yieldToUser = () => {
      if (el.scrollTop === restoreTarget) return;
      stopRestoring();
    };

    const handleScroll = () => {
      if (restoring) return;
      remember(key, el.scrollTop);
    };

    el.addEventListener('scroll', handleScroll, { passive: true });
    el.addEventListener('wheel', yieldToUser, { passive: true });
    el.addEventListener('pointerdown', yieldToUser, { passive: true });

    return () => {
      if (raf) cancelAnimationFrame(raf);
      stopRestoring();
      el.removeEventListener('scroll', handleScroll);
      el.removeEventListener('wheel', yieldToUser);
      el.removeEventListener('pointerdown', yieldToUser);
    };
  }, []);

  return areaRef;
}
