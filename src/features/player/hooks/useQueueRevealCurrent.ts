import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ListRange, VirtuosoHandle } from 'react-virtuoso';

const isIndexInRange = (index: number | null, range: ListRange) =>
  index !== null && index >= range.startIndex && index <= range.endIndex;

interface UseQueueRevealCurrentOptions {
  currentIndex: number | null;
  /** 队列长度：切歌 / 增删后可视区间可能没变，需借它重算一次可见性。 */
  itemCount: number;
}

/**
 * 队列列表的「当前项可见性 + 回到当前播放」视图模型。
 *
 * 可见性取自 Virtuoso 的 `rangeChanged`（已渲染区间，含 `overscan`）：当前行离开
 * 视口约一两行即判定为「已滚出」，对回正按钮够用；按钮的位置/样式由 QueueList 提供，
 * 两个 surface 共用这一份逻辑。
 */
export const useQueueRevealCurrent = ({
  currentIndex,
  itemCount,
}: UseQueueRevealCurrentOptions) => {
  const listRef = useRef<VirtuosoHandle>(null);
  const lastRangeRef = useRef<ListRange | null>(null);
  // 首屏就是按 currentIndex 居中定位的，初值取可见。
  const [currentInView, setCurrentInView] = useState(true);

  const onRangeChanged = useCallback(
    (range: ListRange) => {
      lastRangeRef.current = range;
      setCurrentInView(isIndexInRange(currentIndex, range));
    },
    [currentIndex],
  );

  useEffect(() => {
    const range = lastRangeRef.current;
    if (range) setCurrentInView(isIndexInRange(currentIndex, range));
  }, [currentIndex, itemCount]);

  const revealCurrent = useCallback(
    (behavior: 'auto' | 'smooth' = 'smooth') => {
      if (currentIndex === null) return;
      listRef.current?.scrollToIndex({
        index: currentIndex,
        align: 'center',
        behavior,
      });
    },
    [currentIndex],
  );

  const canRevealCurrent = currentIndex !== null && !currentInView;

  return useMemo(
    () => ({
      canRevealCurrent,
      listRef,
      onRangeChanged,
      revealCurrent,
    }),
    [canRevealCurrent, onRangeChanged, revealCurrent],
  );
};
