import { useCallback, useEffect, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';

/** 指针静止满 3s、且未停在触发按钮上 → 收起 */
const IDLE_HIDE_MS = 3000;

export interface LyricSeekHint {
  /** 「展示哪行」：当前应展示触发按钮的行下标；null = 不展示 */
  visibleLine: number | null;
  /** 挂在歌词列表容器上的 mousemove：判定「展示哪行」与「是否展示」 */
  handlePointerMove: (event: ReactMouseEvent<HTMLElement>) => void;
  /** 指针离开歌词列表容器：立即收起 */
  handlePointerLeave: () => void;
  /** 指针进出触发按钮：停在按钮上时不算 idle，不参与收起判定 */
  setButtonHovered: (hovered: boolean) => void;
  /** 歌词内容发生位移（播放驱动的自动滚动 / 滚轮）：指针下的行已不是原来那行，收起 */
  handleContentMoved: () => void;
}

/**
 * 歌词行「跳转」按钮的展示裁决，拆成两件互不耦合的事：
 *   - 展示哪行：由 **真实的指针移动** 落点决定（命中哪一行就记哪一行）；
 *   - 是否展示：指针一动就重置 idle 计时，满 IDLE_HIDE_MS 且指针未停在触发按钮上才收起。
 *
 * 关键：内容在静止指针下滚动时，浏览器会补发合成 mousemove/mouseover（hit-test 重跑），
 * 坐标与上一条完全相同 —— 那不是用户操作，一律忽略并收起，否则「播放自动滚动到鼠标下」
 * 会凭空弹出按钮。同理，歌词位移（自动滚动/滚轮）本身也直接收起。
 *
 * 纯视图局部状态（无 store / service），状态跟着列表走，故只需在切歌重排时 reset。
 */
export function useLyricSeekHint(resetKey?: string | number): LyricSeekHint {
  const [hoveredLine, setHoveredLine] = useState<number | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isButtonHoveredRef = useRef(false);
  /** 上一条指针事件的坐标：坐标未变 = 内容在指针下滚动引发的合成事件 */
  const pointerRef = useRef<{ x: number; y: number } | null>(null);

  const clearIdleTimer = useCallback(() => {
    if (idleTimerRef.current !== null) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
  }, []);

  const armIdleTimer = useCallback(() => {
    clearIdleTimer();
    idleTimerRef.current = setTimeout(() => {
      idleTimerRef.current = null;
      // 停在按钮上不算 idle：保持展示，等离开按钮（setButtonHovered(false)）再重新计时
      if (isButtonHoveredRef.current) return;
      setIsVisible(false);
    }, IDLE_HIDE_MS);
  }, [clearIdleTimer]);

  /** 收起：清定时器、清 hover 行、清按钮悬停态 */
  const hideHint = useCallback(() => {
    clearIdleTimer();
    isButtonHoveredRef.current = false;
    setHoveredLine(null);
    setIsVisible(false);
  }, [clearIdleTimer]);

  const reset = useCallback(() => {
    hideHint();
    pointerRef.current = null;
  }, [hideHint]);

  // 卸载与切歌（歌词重排、行号失效）都要清掉定时器与 hover 残留
  useEffect(() => reset, [reset, resetKey]);

  const handlePointerMove = useCallback(
    (event: ReactMouseEvent<HTMLElement>) => {
      const point = { x: event.clientX, y: event.clientY };
      const last = pointerRef.current;
      pointerRef.current = point;

      // 坐标没动 = 内容滚到了静止的指针下面（hit-test 重跑的合成事件），不是用户操作
      if (last && last.x === point.x && last.y === point.y) {
        hideHint();
        return;
      }

      const lineEl = (event.target as Element | null)?.closest('[data-line]');
      if (!lineEl) return; // 行间空隙/空白：不算离开，保持现状

      const lineIndex = Number(lineEl.getAttribute('data-line'));
      if (!Number.isInteger(lineIndex)) return;

      setHoveredLine(lineIndex);
      setIsVisible(true);
      armIdleTimer();
    },
    [armIdleTimer, hideHint],
  );

  const handleContentMoved = useCallback(() => {
    hideHint();
  }, [hideHint]);

  const setButtonHovered = useCallback(
    (hovered: boolean) => {
      isButtonHoveredRef.current = hovered;
      // 离开按钮（指针仍在行内）后重新开始计时
      if (!hovered) armIdleTimer();
    },
    [armIdleTimer],
  );

  return {
    visibleLine: isVisible ? hoveredLine : null,
    handlePointerMove,
    handlePointerLeave: hideHint,
    setButtonHovered,
    handleContentMoved,
  };
}
