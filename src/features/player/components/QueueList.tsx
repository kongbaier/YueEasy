import type { ReactNode } from 'react';
import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import type { ListRange, VirtuosoHandle } from 'react-virtuoso';
import { Virtuoso } from 'react-virtuoso';
import type { Track } from '@/shared/types/player';
import { VirtuosoScroller } from '@/shared/ui/virtuoso';

export interface QueueListHandle {
  /** 把当前项滚入可视区（首屏已按 currentIndex 定位，这里只用于用户主动触发）。 */
  revealCurrent: (behavior?: 'auto' | 'smooth') => void;
}

interface QueueListProps {
  queue: Track[];
  /** 单行固定高度（px）：虚拟滚动等高校准，与各行样式保持一致。 */
  itemHeight: number;
  /**
   * 当前播放项。首屏直接以 `initialTopMostItemIndex` 渲染在该项上（居中），
   * 不再「先渲染到顶部、再由 effect 滚过去」；同时也是 revealCurrent 的目标。
   */
  currentIndex: number | null;
  /** 可视区间变化（滚动驱动），供"当前项是否已可见"等判断。 */
  onRangeChanged?: (range: ListRange) => void;
  renderItem: (track: Track, index: number) => ReactNode;
}

/**
 * 队列列表滚动 / 测量层：QueuePanel 与 PlayerPageQueue 共用同一套虚拟滚动参数，
 * 行样式仍由各自 surface 提供（抽屉与全屏页视觉不同）。
 *
 * 注意：列表需在「可见时挂载」（抽屉展开 / 页签激活），
 * initialTopMostItemIndex 只在首次渲染生效。
 */
export const QueueList = forwardRef<QueueListHandle, QueueListProps>(
  ({ queue, itemHeight, currentIndex, onRangeChanged, renderItem }, ref) => {
    const virtuosoRef = useRef<VirtuosoHandle>(null);

    // 首屏定位只在挂载时取一次：
    // · 之后切歌不打扰用户滚动（需要跟随请调 revealCurrent）
    // · identity 保持稳定——react-virtuoso 每次渲染都会把所有 props 重新推入内部 system，
    //   每次新建 `initialTopMostItemIndex` 对象会被判定为变化，从而反复重算初始位置。
    const [initialLocation] = useState(() => ({
      index: currentIndex ?? 0,
      align: 'center' as const,
    }));

    useImperativeHandle(
      ref,
      () => ({
        revealCurrent: (behavior = 'auto') => {
          if (currentIndex === null) return;
          virtuosoRef.current?.scrollToIndex({
            index: currentIndex,
            align: 'center',
            behavior,
          });
        },
      }),
      [currentIndex],
    );

    return (
      <Virtuoso
        components={{ Scroller: VirtuosoScroller }}
        computeItemKey={(index) => queue[index]?.id ?? index}
        fixedItemHeight={itemHeight}
        initialTopMostItemIndex={initialLocation}
        itemContent={(index) => renderItem(queue[index], index)}
        overscan={100}
        rangeChanged={onRangeChanged}
        ref={virtuosoRef}
        style={{ height: '100%' }}
        totalCount={queue.length}
      />
    );
  },
);

QueueList.displayName = 'QueueList';
