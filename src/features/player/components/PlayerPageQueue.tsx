import { LocateFixed, Music, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ListRange } from 'react-virtuoso';
import { AnimatePresence, motion } from 'motion/react';
import { Button } from '@/shared/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog';
import { DecodedImage } from '@/shared/ui/image';
import { toast } from '@/shared/lib/toast';
import { cn } from '@/shared/utils/cn';
import { getNcmImageUrl } from '@/shared/utils/image';
import { formatQueueCount } from '@/shared/utils/format';
import { usePlayerPage } from '@/features/player/hooks/usePlayerPage';
import { usePlayer } from '@/features/player/hooks/usePlayer';
import { QueueList } from './QueueList';
import type { QueueListHandle } from './QueueList';
import { PlayerTabPanel } from './PlayerTabPanel';
import type { Track } from '@/shared/types/player';

/** 与 QueueItem 行高（h-[52px]：text-sm 20 + text-xs 16 + py-2*2）一致。 */
const ROW_HEIGHT = 52;

const isIndexInRange = (index: number | null, range: ListRange) =>
  index !== null && index >= range.startIndex && index <= range.endIndex;

const QueueItem = ({
  track,
  index,
  isCurrent,
  onPlay,
  onRemove,
}: {
  track: Track;
  index: number;
  isCurrent: boolean;
  onPlay: (index: number) => void;
  onRemove: (index: number) => void;
}) => {
  return (
    <div
      className={cn(
        'group flex items-center h-13 gap-3 px-2 py-2 w-full text-left cursor-pointer transition-colors hover:bg-accent rounded-md',
        isCurrent && 'bg-primary/10',
      )}
      onDoubleClick={() => onPlay(index)}
      onKeyDown={() => onPlay(index)}
      role="option"
      tabIndex={0}
    >
      <div className="w-9 h-9 rounded bg-secondary flex items-center justify-center shrink-0 overflow-hidden">
        {track.album?.picUrl ? (
          <DecodedImage
            alt={track.album.name}
            className="size-full object-cover"
            containerClassName="size-full"
            lazy
            src={getNcmImageUrl(track.album.picUrl, 50)}
          />
        ) : (
          <Music className="size-4 text-muted-foreground" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className={cn('text-sm truncate', isCurrent && 'text-primary')}>
          {track.name}
        </p>
        <p className="text-xs text-muted-foreground truncate">
          {track.artists?.map((a) => a.name).join(' / ') || ' '}
        </p>
      </div>

      <button
        className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 rounded p-1 text-muted-foreground hover:text-foreground"
        onClick={(e) => {
          e.stopPropagation();
          onRemove(index);
        }}
        type="button"
      >
        <Trash2 className="size-3.5" />
      </button>
    </div>
  );
};

/**
 * 页签内容区：仅在页签可见时挂载。
 * 列表首屏就按 currentIndex 定位，可见性状态随挂载天然重置——
 * 所以不需要「离开页签复位」之类的 effect。
 */
const QueueTabContent = ({
  currentIndex,
  onPlay,
  onRemove,
  queue,
}: {
  currentIndex: number | null;
  onPlay: (index: number) => void;
  onRemove: (index: number) => void;
  queue: Track[];
}) => {
  const listRef = useRef<QueueListHandle>(null);
  const lastRangeRef = useRef<ListRange | null>(null);
  // 当前项是否已在可视区内（初始视为可见：首屏就是按 currentIndex 定位的）。
  const [currentInView, setCurrentInView] = useState(true);

  const handleRangeChanged = useCallback(
    (range: ListRange) => {
      lastRangeRef.current = range;
      setCurrentInView(isIndexInRange(currentIndex, range));
    },
    [currentIndex],
  );

  // 双击可视行切歌 / 队列增删时可视区间不变、rangeChanged 不触发，
  // 用最近一次区间重算一次。
  useEffect(() => {
    const range = lastRangeRef.current;
    if (range) setCurrentInView(isIndexInRange(currentIndex, range));
  }, [currentIndex, queue.length]);

  // 「回到当前播放」：仅当有当前项、且当前项被滚出视口时才出现。
  const canRevealCurrent = currentIndex !== null && !currentInView;

  return (
    <>
      <QueueList
        currentIndex={currentIndex}
        itemHeight={ROW_HEIGHT}
        onRangeChanged={handleRangeChanged}
        queue={queue}
        ref={listRef}
        renderItem={(track, index) => (
          <QueueItem
            index={index}
            isCurrent={index === currentIndex}
            onPlay={onPlay}
            onRemove={onRemove}
            track={track}
          />
        )}
      />

      <AnimatePresence>
        {canRevealCurrent && (
          <motion.button
            aria-label="回到当前播放"
            animate={{ opacity: 1, y: 0 }}
            className="absolute bottom-4 right-4 size-10 z-10 flex items-center justify-center rounded-full border border-border bg-background/90 shadow-lg backdrop-blur-sm transition-colors hover:bg-accent"
            exit={{ opacity: 0, y: 4 }}
            initial={{ opacity: 0, y: 4 }}
            onClick={() => listRef.current?.revealCurrent('smooth')}
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

export const PlayerPageQueue = () => {
  const {
    queue,
    queueLength,
    currentIndex,
    playFromIndex,
    isFm,
    clearQueue,
    removeFromQueue,
  } = usePlayer();
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);

  const { close } = usePlayerPage();

  const handleClear = () => {
    // 清空队列：先关闭播放页（退出动画展示清空前的内容），
    // 页面退出动画结束后（AnimatePresence onExitComplete）才真正清空。
    close(() => {
      clearQueue();
    });
    setClearConfirmOpen(false);
    toast.success('播放列表已清空');
  };

  const handleRemove = (index: number) => {
    if (queue.length === 1) {
      // 移除最后一首 = 清空队列：同样先关页面，动画结束再移除
      close(() => removeFromQueue(index));
    } else {
      removeFromQueue(index);
    }
  };

  return (
    <PlayerTabPanel
      action={
        !isFm && queue.length > 0 ? (
          <Button
            className="shrink-0 rounded p-1 text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setClearConfirmOpen(true)}
            title="清空播放列表"
            type="button"
            variant="ghost"
          >
            <Trash2 className="size-4" />
          </Button>
        ) : null
      }
      count={queueLength}
      formatCount={formatQueueCount}
      title="播放列表"
    >
      <QueueTabContent
        currentIndex={currentIndex}
        onPlay={playFromIndex}
        onRemove={handleRemove}
        queue={queue}
      />

      {!isFm && (
        <Dialog onOpenChange={setClearConfirmOpen} open={clearConfirmOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>清空播放列表</DialogTitle>
              <DialogDescription>
                确定要清空播放列表吗？此操作不可撤销。
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                onClick={() => setClearConfirmOpen(false)}
                variant="outline"
              >
                取消
              </Button>
              <Button onClick={handleClear}>确定</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </PlayerTabPanel>
  );
};
