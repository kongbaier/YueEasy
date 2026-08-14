import { Loader2, Music, Radio, ThumbsDown, Trash2, X } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';
import type { VirtuosoHandle } from 'react-virtuoso';
import { Virtuoso } from 'react-virtuoso';
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
import { VirtuosoScroller } from '@/shared/ui/virtuoso';
import { SmartImage } from '@/shared/ui/image';
import type { Track } from '@/shared/types/player';
import { toast } from '@/shared/lib/toast';
import { cn } from '@/shared/utils/cn';
import { getNcmImageUrl } from '@/shared/utils/image';
import { formatQueueCount } from '@/shared/utils/format';
import { usePlayer } from '@/modules/player/hooks/usePlayer';

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
}) => (
  <div
    className={cn(
      'group flex items-center px-4 py-2 w-full cursor-pointer transition-colors hover:bg-surface-hover',
      isCurrent && 'bg-primary/10',
    )}
  >
    <button
      className="flex-1 min-w-0 items-center flex text-left gap-3"
      onDoubleClick={() => onPlay(index)}
      tabIndex={0}
      type="button"
    >
      <div className="w-8 h-8 rounded shadow dark:shadow-none dark:ring-1 dark:ring-white/10 flex items-center justify-center shrink-0 overflow-hidden">
        {track.album.picUrl ? (
          <SmartImage
            alt={track.album.name}
            className="size-full object-cover"
            containerClassName="size-full"
            src={getNcmImageUrl(track.album.picUrl, 50)}
          />
        ) : (
          <Music className="size-3.5 text-text-muted" />
        )}
      </div>

      <div className="min-w-0">
        <p className={cn('text-sm truncate', isCurrent && 'text-primary')}>
          {track.name}
        </p>
        <p className="text-xs text-text-muted truncate">
          {track.artists.map((a) => a.name).join(' / ')}
        </p>
      </div>
    </button>

    <Button
      className="opacity-0 group-hover:opacity-100 transition-opacity border-none hover:bg-red-500 hover:text-white"
      onClick={(e: React.MouseEvent) => {
        e.stopPropagation();
        onRemove(index);
      }}
      type="button"
      variant="outline"
    >
      <Trash2 className="size-3" />
    </Button>
  </div>
);

export const QueuePanel = ({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) => {
  const {
    queue,
    queueLength,
    currentTrack,
    currentIndex,
    playFromIndex,
    removeFromQueue,
    clearQueue,
    isFm,
    fmTrash,
    setContentSource,
    fmExitWillEmpty,
  } = usePlayer();
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const [trashPending, setTrashPending] = useState(false);
  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const scrolledOnceRef = useRef(false);

  const handleClose = () => onClose();

  const handlePlayTrack = (index: number) => {
    playFromIndex(index);
  };

  const handleRemove = (index: number) => {
    removeFromQueue(index);
  };

  const handleClear = () => {
    clearQueue();
    setClearConfirmOpen(false);
    toast.success('播放列表已清空');
  };

  const handleFmTrash = async () => {
    if (trashPending) return;
    setTrashPending(true);
    try {
      await fmTrash();
      toast.success('已减少此类推荐');
    } catch {
      toast.error('操作失败，请重试');
    } finally {
      setTrashPending(false);
    }
  };

  // 退出漫游会清空队列（进入漫游前无队列）时，先关面板（退出动画展示漫游内容），
  // 动画结束再执行 exitFm——与播放页“先退出再清空”的统一规则一致。
  const afterCloseRef = useRef<(() => void) | null>(null);
  const closeAfter = (fn: () => void) => {
    afterCloseRef.current = fn;
    onClose();
  };
  const handlePanelExitComplete = () => {
    const fn = afterCloseRef.current;
    afterCloseRef.current = null;
    fn?.();
  };

  const handleExitFm = () => {
    const run = () => {
      void setContentSource('queue').catch(() => toast.error('操作失败，请重试'));
    };
    if (fmExitWillEmpty) {
      closeAfter(run);
    } else {
      // 退出漫游会恢复原队列（有歌可播）：直接退出，面板保持打开展示恢复的歌单
      run();
    }
  };

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

  return (
    <AnimatePresence onExitComplete={handlePanelExitComplete}>
      {open && (
        <div className="isolate fixed inset-0 z-50 flex justify-end">
          <button
            aria-label="关闭播放列表"
            className="absolute inset-0 cursor-default"
            onClick={handleClose}
            type="button"
          />

          <motion.aside
            animate={{ x: 0 }}
            className="relative w-80 h-full bg-white dark:bg-black shadow-xl dark:shadow-black/30 flex flex-col z-10"
            exit={{ x: '100%' }}
            initial={{ x: '100%' }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
          >
            <header className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
              <h2 className="text-sm font-medium flex items-center gap-1.5">
                {isFm ? (
                  <>
                    <Radio className="size-4 text-primary" />
                    私人漫游
                  </>
                ) : (
                  <>
                    播放列表
                    {queueLength > 0 && (
                      <span className="ml-1.5 text-xs text-text-muted">
                        ({formatQueueCount(queueLength)})
                      </span>
                    )}
                  </>
                )}
              </h2>
              <div className="flex items-center gap-1">
                {!isFm && queue.length > 0 && (
                  <Button
                    className="border-none"
                    onClick={() => setClearConfirmOpen(true)}
                    title="清空播放列表"
                    type="button"
                    variant="outline"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                )}
                <Button
                  className="border-none"
                  onClick={handleClose}
                  type="button"
                  variant="outline"
                >
                  <X className="size-4" />
                </Button>
              </div>
            </header>

            <div className="flex-1 relative">
              {isFm ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 px-6">
                  <div className="w-44">
                    <div className="relative aspect-square w-full overflow-hidden rounded-lg shadow-sm dark:shadow-none dark:ring-1 dark:ring-white/10">
                      {currentTrack?.album.picUrl ? (
                        <SmartImage
                          alt={currentTrack.album.name}
                          className="size-full object-cover"
                          containerClassName="size-full"
                          src={getNcmImageUrl(currentTrack.album.picUrl, 200)}
                        />
                      ) : (
                        <div className="flex items-center justify-center size-full bg-accent">
                          <Music className="size-6 text-muted-foreground/60" />
                        </div>
                      )}
                      {currentTrack && (
                        <span className="absolute bottom-1.5 right-1.5 flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm">
                          <Radio className="size-3" />
                          私人漫游
                        </span>
                      )}
                    </div>
                    <div className="mt-3 text-center">
                      <p className="truncate text-sm font-medium">
                        {currentTrack?.name ?? '正在为你挑选音乐…'}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {currentTrack
                          ? currentTrack.artists.map((a) => a.name).join(' / ')
                          : '根据你的口味推荐'}
                      </p>
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground leading-relaxed text-center">
                    不喜欢这首？点一下，让漫游少推荐类似的歌
                  </p>

                  <div className="w-full flex flex-col gap-2">
                    <Button
                      className="h-10 w-full gap-2 text-[0.95rem]"
                      disabled={trashPending}
                      onClick={handleFmTrash}
                      variant="default"
                    >
                      {trashPending ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <ThumbsDown className="size-4" />
                      )}
                      减少推荐
                    </Button>
                    <Button
                      className="h-9 w-full text-muted-foreground hover:text-foreground"
                      onClick={handleExitFm}
                      variant="ghost"
                    >
                      退出漫游
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div
                    className={cn(
                      'absolute inset-0 flex flex-col items-center justify-center gap-2 text-text-muted transition-all duration-300',
                      queue.length === 0
                        ? 'opacity-100 scale-100'
                        : 'opacity-0 scale-95 pointer-events-none',
                    )}
                  >
                    <Music className="size-10 opacity-30" />
                    <p className="text-xs">播放列表为空</p>
                    <p className="text-[10px] opacity-60">
                      双击歌曲即可加入队列
                    </p>
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
                          onPlay={handlePlayTrack}
                          onRemove={handleRemove}
                          track={queue[index]}
                        />
                      )}
                      overscan={100}
                      ref={(ref) => {
                        virtuosoRef.current = ref;
                        if (ref && !scrolledOnceRef.current && currentIndex !== null) {
                          scrolledOnceRef.current = true;
                          scrollToCurrent();
                        }
                      }}
                      style={{ height: '100%' }}
                      totalCount={queue.length}
                    />
                  </div>
                </>
              )}
            </div>
          </motion.aside>

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
      )}
    </AnimatePresence>
  );
};
