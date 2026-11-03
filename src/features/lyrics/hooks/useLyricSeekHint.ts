import { useCallback, useEffect, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';

export interface LyricSeekHint {
  /** 「展示哪行」：当前应展示触发按钮的行下标；null = 不展示 */
  visibleLine: number | null;
  /** 挂在歌词列表容器上的 mousemove：判定「展示哪行」 */
  handlePointerMove: (event: ReactMouseEvent<HTMLElement>) => void;
  /** 指针离开歌词列表容器：立即收起 */
  handlePointerLeave: () => void;
  /** 歌词内容发生位移（播放驱动的自动滚动 / 滚轮）：指针下的行已不是原来那行，收起 */
  handleContentMoved: () => void;
  /** 触发按钮获得「可见焦点」：展示该行按钮，焦点停留期间不收起 */
  handleHintFocus: (lineIndex: number) => void;
  /** 触发按钮失焦 */
  handleHintBlur: () => void;
}

/**
 * 歌词行「跳转」按钮的展示裁决，只回答一件事：**指针此刻停在哪一行**。
 *
 * 显形规则就是 hover 语义（与主流歌词组件一致）：指针进到某行 → 该行按钮显形；
 * 指针离开列表、或歌词内容在指针下位移（播放自动滚动 / 滚轮）→ 收起。
 * **没有计时器**：指针停着不动不等于「离开」，按钮不该在脚底下自己消失。
 *
 * 关键：指针静止、内容又在滚动时，浏览器会在 hit-test 重跑后补发一条**坐标完全相同**的
 * mousemove —— 那不是用户操作，按坐标去重并收起，否则「自动滚动到指针下」会凭空弹出按钮。
 * 同理，歌词位移（自动滚动 / 滚轮）本身也直接收起。
 *
 * 职责边界：本 hook 只管「按钮的展示」，不管「视图跟着走」—— 焦点定位由
 * useLyricScroll.focusLine 负责，两者在 Lyrics 里组合成一次「键盘用户操作」。
 *
 * 纯视图局部状态（无 store / service），状态跟着列表走，故只需在切歌重排时 reset。
 */
export function useLyricSeekHint(resetKey?: string | number): LyricSeekHint {
  const [hoveredLine, setHoveredLine] = useState<number | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  /** 可见焦点是否在某个按钮上：焦点期间不收起（否则聚焦元素连焦点环一起变不可见） */
  const isFocusedRef = useRef(false);
  /** 上一条指针事件的坐标：坐标未变 = 内容在指针下滚动引发的合成事件 */
  const pointerRef = useRef<{ x: number; y: number } | null>(null);

  /** 收起：清 hover 行；焦点还在某行按钮上时不动（焦点环必须保持可见） */
  const hideHint = useCallback(() => {
    if (isFocusedRef.current) return;
    setHoveredLine(null);
    setIsVisible(false);
  }, []);

  const reset = useCallback(() => {
    isFocusedRef.current = false;
    pointerRef.current = null;
    setHoveredLine(null);
    setIsVisible(false);
  }, []);

  // 卸载与切歌（歌词重排、行号失效）都要清掉 hover 残留
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
    },
    [hideHint],
  );

  const handlePointerLeave = useCallback(() => {
    pointerRef.current = null;
    hideHint();
  }, [hideHint]);

  const handleContentMoved = useCallback(() => {
    hideHint();
  }, [hideHint]);

  /** 可见焦点进入某行按钮：展示该行按钮，焦点停留期间不收起 */
  const handleHintFocus = useCallback((lineIndex: number) => {
    isFocusedRef.current = true;
    setHoveredLine(lineIndex);
    setIsVisible(true);
  }, []);

  const handleHintBlur = useCallback(() => {
    isFocusedRef.current = false;
    // 焦点离开后按钮没有理由继续常显：下次指针移动会按 hover 语义重新裁决
    hideHint();
  }, [hideHint]);

  return {
    visibleLine: isVisible ? hoveredLine : null,
    handlePointerMove,
    handlePointerLeave,
    handleContentMoved,
    handleHintFocus,
    handleHintBlur,
  };
}
