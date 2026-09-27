import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

/** 用户操作（滚轮 / 键盘焦点定位）后，闲置这么久就归位到当前播放行 */
const USER_IDLE_MS = 3000;

/**
 * 歌词列表的位移引擎：只用 transform，不依赖滚动容器 —— 因此不存在与浏览器 scrollTop
 * 平行的第二套位移（那是「滚轮 clamp 失效、顶穿下边界、回不到最上方」的根源）。
 *
 * 位移有两个驱动源，且共用同一套「用户操作」判定：
 *   - 用户：滚轮 / 键盘焦点定位（focusLine）→ 立即设位并进入 isUserOperate（暂停自动跟随），
 *           闲置 USER_IDLE_MS 后**定时归位**到当前目标行；
 *   - 播放：目标行变化时居中 —— 只在非用户操作时生效。
 *
 * 入参是「目标行」而不是「播放行」：播放行 → 目标行的映射（跳空行、前奏落到第一句）
 * 属于歌词域知识，由 scroll-target.ts 负责；本 hook 只管把给定行号居中。
 */
export function useLyricScroll(
  targetLineIndex: number,
  enabled: boolean,
  resetKey?: string | number,
): {
  containerRef: React.RefObject<HTMLDivElement | null>;
  contentRef: React.RefObject<HTMLUListElement | null>;
  contentStyle: React.CSSProperties;
  /** 当前内容位移量（px）：内容在指针下滑动时用于让 hover 类交互失效 */
  translateY: number;
  /** 键盘焦点定位：把某行居中，并按「用户操作」处理（暂停跟随 + 重新计时归位） */
  focusLine: (lineIndex: number) => void;
} {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLUListElement>(null);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isUserOperate, setIsUserOperate] = useState(false);
  /** 同一语义的 ref：定时器回调 / ResizeObserver 里读到的必须是即时值，不能吃闭包旧 state */
  const isUserOperateRef = useRef(false);
  /** 同上：定时归位发生在 3s 之后，要用**当时**的目标行，而不是订阅那一刻的行 */
  const targetLineRef = useRef(targetLineIndex);
  const prevResetKeyRef = useRef(resetKey);
  const hasPositionedRef = useRef(false);
  const [translateY, setTranslateY] = useState(0);
  const [hasPositioned, setHasPositioned] = useState(false);

  useEffect(() => {
    targetLineRef.current = targetLineIndex;
  }, [targetLineIndex]);

  const clearIdleTimer = useCallback(() => {
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      hasPositionedRef.current = false;
    }
  }, [enabled]);

  /** 可位移区间：0（顶部）～ -overflow（底部） */
  const getBounds = useCallback(() => {
    const container = containerRef.current;
    const content = contentRef.current;
    if (!container || !content) return null;

    const cRect = container.getBoundingClientRect();
    const wRect = content.getBoundingClientRect();
    const overflow = wRect.height - cRect.height;
    return {
      containerHeight: cRect.height,
      contentTop: wRect.top,
      min: overflow > 0 ? -overflow : 0,
      max: 0,
    };
  }, []);

  const clampTranslate = useCallback(
    (value: number) => {
      const bounds = getBounds();
      if (!bounds) return value;
      return Math.max(bounds.min, Math.min(bounds.max, value));
    },
    [getBounds],
  );

  /** 把某一行居中所需的位移（已 clamp）；行不在 DOM 里返回 null */
  const idealForLine = useCallback(
    (lineIndex: number) => {
      const container = containerRef.current;
      if (!container) return null;
      const lineEl = container.querySelector(`[data-line="${lineIndex}"]`);
      if (!lineEl) return null;
      const bounds = getBounds();
      if (!bounds) return null;

      const lRect = lineEl.getBoundingClientRect();
      const lineCenter = lRect.top - bounds.contentTop + lRect.height / 2;
      const ideal = bounds.containerHeight / 2 - lineCenter;
      return Math.max(bounds.min, Math.min(bounds.max, ideal));
    },
    [getBounds],
  );

  /**
   * 把目标行居中。「定时归位」与「播放推进」都走它 —— 用户操作期间直接跳过：
   * 视图归用户所有，不能被播放或布局变化抢走。
   */
  const recenter = useCallback(
    (lineIndex = targetLineRef.current) => {
      if (isUserOperateRef.current) return;
      const ideal = idealForLine(lineIndex);
      if (ideal !== null) setTranslateY(ideal);
    },
    [idealForLine],
  );

  /** 进入「用户操作」态并重新计时；闲置 USER_IDLE_MS 后归位到目标行 */
  const beginUserOperate = useCallback(() => {
    isUserOperateRef.current = true;
    setIsUserOperate(true);
    clearIdleTimer();
    idleTimerRef.current = setTimeout(() => {
      idleTimerRef.current = null;
      // 定时器每次用户操作都会重置，能走到这里 = 用户已停止操作 → 可以归位
      isUserOperateRef.current = false;
      setIsUserOperate(false);
      recenter();
    }, USER_IDLE_MS);
  }, [clearIdleTimer, recenter]);

  /** 键盘焦点定位：与滚轮同属「用户操作」，同样暂停跟随、同样闲置后归位 */
  const focusLine = useCallback(
    (lineIndex: number) => {
      const ideal = idealForLine(lineIndex);
      if (ideal === null) return;
      beginUserOperate();
      setTranslateY(ideal);
    },
    [beginUserOperate, idealForLine],
  );

  useEffect(() => {
    if (!enabled) return;
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      beginUserOperate();
      setTranslateY((prev) => clampTranslate(prev - e.deltaY));
    };

    container.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      container.removeEventListener('wheel', handleWheel);
      clearIdleTimer();
    };
  }, [enabled, beginUserOperate, clampTranslate, clearIdleTimer]);

  // 在 paint 之前完成定位，避免第一帧看到错误位置
  useLayoutEffect(() => {
    const resetKeyChanged =
      resetKey !== undefined && prevResetKeyRef.current !== resetKey;
    prevResetKeyRef.current = resetKey;

    if (resetKeyChanged) {
      clearIdleTimer();
      isUserOperateRef.current = false;
      setIsUserOperate(false);
      setTranslateY(0);
      hasPositionedRef.current = false;
      setHasPositioned(false);
    }

    if (targetLineIndex < 0 || !enabled) return;

    recenter(targetLineIndex);

    if (!hasPositionedRef.current) {
      const content = contentRef.current;
      if (content && content.getBoundingClientRect().height > 0) {
        hasPositionedRef.current = true;
        requestAnimationFrame(() => {
          setHasPositioned(true);
        });
      }
    }
  }, [targetLineIndex, enabled, resetKey, recenter, clearIdleTimer]);

  useEffect(() => {
    if (!enabled) return;
    const content = contentRef.current;
    if (!content) return;

    const observer = new ResizeObserver(() => {
      if (!hasPositionedRef.current) {
        recenter();
        const el = contentRef.current;
        if (el && el.getBoundingClientRect().height > 0) {
          // 强制重绘确保新位置已提交到屏幕，再启用 transition
          el.getBoundingClientRect();
          hasPositionedRef.current = true;
          requestAnimationFrame(() => {
            setHasPositioned(true);
          });
        }
        return;
      }

      recenter();
    });

    observer.observe(content);
    return () => observer.disconnect();
  }, [enabled, recenter]);

  return {
    containerRef,
    contentRef,
    translateY,
    focusLine,
    contentStyle: {
      transform: `translateY(${translateY}px)`,
      transition:
        !hasPositioned || isUserOperate ? 'none' : 'transform 0.3s ease-in-out',
    },
  };
}
