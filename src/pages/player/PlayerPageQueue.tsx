import { Music, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
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
import { usePlayerPage } from '@/modules/player/contexts/PlayerPageContext';
import { formatQueueCount } from '@/shared/utils/format';
import { usePlayer } from '@/modules/player/hooks/usePlayer';
import type { Track } from '@/shared/types/player';

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
        'group flex items-center gap-3 px-2 py-2 w-full text-left cursor-pointer transition-colors hover:bg-accent rounded-md',
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
          {track.artists?.map((a) => a.name).join(' / ') || ' '}
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
  const listRef = useRef<HTMLDivElement>(null);
  const scrolledOnceRef = useRef(false);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);

  const { close } = usePlayerPage();

  // 首次挂载后把当前播放项滚到可视区中间（只做一次）。
  // 延迟到入场动画结束、布局稳定后再量高度。
  useEffect(() => {
    if (scrolledOnceRef.current || currentIndex === null) return;
    scrolledOnceRef.current = true;

    const timer = setTimeout(() => {
      const el = listRef.current;
      const item = el?.children[currentIndex] as HTMLElement | undefined;
      if (!el || !item) return;
      const offset =
        el.scrollTop +
        item.getBoundingClientRect().top -
        el.getBoundingClientRect().top;
      el.scrollTop = Math.max(
        0,
        offset - (el.clientHeight - item.offsetHeight) / 2,
      );
    }, 50);

    return () => clearTimeout(timer);
  }, [currentIndex]);

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
    <div className="h-full w-full overflow-y-auto scrollbar-gutter-stable pr-4 xl:pr-8">
      <header className="sticky top-0 flex items-center justify-between py-3 z-10 bg-[#fafafa] dark:bg-[#0a0a0a]">
        <h2 className="text-sm font-medium flex items-center gap-1.5">
          播放列表
          {queueLength > 0 && (
            <span className="ml-1.5 text-xs text-muted-foreground">
              ({formatQueueCount(queueLength)})
            </span>
          )}
        </h2>
        {!isFm && queue.length > 0 && (
          <button
            className="shrink-0 rounded p-1 text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setClearConfirmOpen(true)}
            title="清空播放列表"
            type="button"
          >
            <Trash2 className="size-4" />
          </button>
        )}
      </header>

      <div>
        <div
          className="h-full w-full"
          ref={listRef}
          style={{ scrollbarWidth: 'none' }}
        >
          {queue.map((track, index) => (
            <QueueItem
              index={index}
              isCurrent={index === currentIndex}
              key={track.id}
              onPlay={playFromIndex}
              onRemove={handleRemove}
              track={track}
            />
          ))}
        </div>
      </div>

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
    </div>
  );
};
