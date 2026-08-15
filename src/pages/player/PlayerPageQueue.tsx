import { Music, Trash2 } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';
import type { VirtuosoHandle } from 'react-virtuoso';
import { Virtuoso } from 'react-virtuoso';
import { Button } from '@/shared/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog';
import { VirtuosoScroller } from '@/shared/ui/virtuoso';
import { SmartImage } from '@/shared/ui/image';
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
          <SmartImage
            alt={track.album.name}
            className="size-full object-cover"
            containerClassName="size-full"
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
  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const scrolledOnceRef = useRef(false);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);

  const { close } = usePlayerPage();

  const scrollToCurrent = useCallback(() => {
    if (currentIndex !== null) {
      setTimeout(() => {
        virtuosoRef.current?.scrollToIndex({
          index: currentIndex,
          align: 'center',
        });
      }, 50);
    }
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
    <div className="h-full w-full flex flex-col px-8 lg:px-12">
      <header className="flex items-center justify-between py-3 shrink-0">
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

      <div className="flex-1 relative">
        <>
          <div
            className={cn(
              'absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground transition-all duration-300',
              queue.length === 0
                ? 'opacity-100 scale-100'
                : 'opacity-0 scale-95 pointer-events-none',
            )}
          >
            <Music className="size-10 opacity-30" />
            <p className="text-xs">播放列表为空</p>
            <p className="text-[10px] opacity-60">双击歌曲即可加入队列</p>
          </div>
          <div
            className={cn(
              'h-full transition-all duration-300',
              queue.length > 0
                ? 'opacity-100 translate-y-0'
                : 'opacity-0 translate-y-2 pointer-events-none',
            )}
          >
            <Virtuoso
              components={{ Scroller: VirtuosoScroller }}
              computeItemKey={(index) => queue[index]?.id ?? index}
              fixedItemHeight={48}
              itemContent={(index) => (
                <QueueItem
                  index={index}
                  isCurrent={index === currentIndex}
                  onPlay={playFromIndex}
                  onRemove={handleRemove}
                  track={queue[index]}
                />
              )}
              overscan={50}
              ref={(ref) => {
                virtuosoRef.current = ref;
                if (ref && !scrolledOnceRef.current && currentIndex !== null) {
                  scrolledOnceRef.current = true;
                  scrollToCurrent();
                }
              }}
              style={{ height: '100%', width: '100%' }}
              totalCount={queue.length}
            />
          </div>
        </>
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
