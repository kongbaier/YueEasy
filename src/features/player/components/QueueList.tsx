import { LocateFixed } from 'lucide-react';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Virtuoso } from 'react-virtuoso';
import type { Track } from '@/shared/types/player';
import { VirtuosoScroller } from '@/shared/ui/virtuoso';
import { useQueueRevealCurrent } from '@/features/player/hooks/useQueueRevealCurrent';

interface QueueListProps {
  queue: Track[];
  /** 单行固定高度（px）：虚拟滚动等高校准，与各行样式保持一致。 */
  itemHeight: number;
  /**
   * 当前播放项。首屏直接以 `initialTopMostItemIndex` 渲染在该项上（居中），
   * 不再「先渲染到顶部、再由 effect 滚过去」；同时也是回正按钮的目标。
   */
  currentIndex: number | null;
  renderItem: (track: Track, index: number) => ReactNode;
}

/**
 * 队列列表滚动 / 测量层：QueuePanel 与 PlayerPageQueue 共用同一套虚拟滚动参数，
 * 行样式仍由各自 surface 提供（抽屉与全屏页视觉不同）。
 *
 * 「当前项被滚出视口 → 右下角回正按钮」也收在这里（`useQueueRevealCurrent`），
 * 两个 surface 都自动获得该能力，不再各自实现一遍。
 * 按钮是绝对定位，需要外层有定位上下文（两个 surface 的内容区都是 `relative`）。
 *
 * 注意：列表需在「可见时挂载」（抽屉展开 / 页签激活），
 * initialTopMostItemIndex 只在首次渲染生效。
 */
export const QueueList = ({
  queue,
  itemHeight,
  currentIndex,
  renderItem,
}: QueueListProps) => {
  const { canRevealCurrent, listRef, onRangeChanged, revealCurrent } =
    useQueueRevealCurrent({ currentIndex, itemCount: queue.length });

  // 首屏定位只在挂载时取一次：
  // · 之后切歌不打扰用户滚动（需要跟随请用回正按钮）
  // · identity 保持稳定——react-virtuoso 每次渲染都会把所有 props 重新推入内部 system，
  //   每次新建 `initialTopMostItemIndex` 对象会被判定为变化，从而反复重算初始位置。
  const [initialLocation] = useState(() => ({
    index: currentIndex ?? 0,
    align: 'center' as const,
  }));

  return (
    <>
      <Virtuoso
        components={{ Scroller: VirtuosoScroller }}
        computeItemKey={(index) => queue[index]?.id ?? index}
        fixedItemHeight={itemHeight}
        initialTopMostItemIndex={initialLocation}
        itemContent={(index) => renderItem(queue[index], index)}
        overscan={100}
        rangeChanged={onRangeChanged}
        ref={listRef}
        style={{ height: '100%' }}
        totalCount={queue.length}
      />

      <AnimatePresence>
        {canRevealCurrent && (
          <motion.button
            aria-label="回到当前播放"
            animate={{ opacity: 1, y: 0 }}
            className="absolute bottom-4 right-4 size-10 z-10 flex items-center justify-center rounded-full border border-border bg-background/90 shadow-lg backdrop-blur-sm transition-colors hover:bg-accent"
            exit={{ opacity: 0, y: 4 }}
            initial={{ opacity: 0, y: 4 }}
            onClick={() => revealCurrent('smooth')}
            title="回到当前播放"
            transition={{ duration: 0.15, ease: 'easeOut' }}
            type="button"
          >
            <LocateFixed className="size-4.5" />
          </motion.button>
        )}
      </AnimatePresence>
    </>
  );
};
