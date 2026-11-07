import { useLayoutEffect, useRef, useState } from 'react';

/**
 * 当前句的「溢出距离」（px）：文字比视口宽多少，0 = 装得下。
 *
 * 只负责**量**，不负责动 —— 滚动位置由播放进度决定（见 `DesktopLyricsScrollingLine`）：
 * 这两种歌词共用一套映射，逐字（yrc）与普通（lrc）都跟着「这一句唱到哪」走，
 * 而不是按固定速度跑一遍跑马灯（那样唱到一半词已经滚过去了）。
 *
 * 装在 `useLayoutEffect` 里量（布局已定、绘制前），`measureKey` 变化（换句 / 改字号）时重量。
 */
export function useOverflowDistance(measureKey: string) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [overflowPx, setOverflowPx] = useState(0);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    const content = contentRef.current;
    if (!viewport || !content) return;

    const distance = Math.round(content.scrollWidth - viewport.clientWidth);
    setOverflowPx(distance > 0 ? distance : 0);
  }, [measureKey]);

  return { viewportRef, contentRef, overflowPx };
}
