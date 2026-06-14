import { Music, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { VirtuosoHandle } from "react-virtuoso";
import { Virtuoso } from "react-virtuoso";
import { useShallow } from "zustand/shallow";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ImageWithFade } from "@/components/ui/image";
import { VirtuosoScroller } from "@/components/virtuoso";
import type { Track } from "@/core/player/types";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { usePlayerStore } from "@/stores";
import { useQueuePanelStore } from "@/stores/queuePanelStore";

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
      "group flex items-center px-4 py-2 w-full cursor-pointer transition-colors hover:bg-surface-hover",
      isCurrent && "bg-primary/10",
    )}
  >
    <button
      className="flex-1 items-center flex text-left gap-3"
      onDoubleClick={() => onPlay(index)}
      tabIndex={0}
      type="button"
    >
      <div className="w-8 h-8 rounded shadow dark:shadow-none dark:ring-1 dark:ring-white/10 flex items-center justify-center shrink-0 overflow-hidden">
        {track.album.picUrl ? (
          <ImageWithFade
            alt={track.album.name}
            className="inset-0 object-cover"
            fill
            src={track.album.picUrl}
          />
        ) : (
          <Music className="size-3.5 text-text-muted" />
        )}
      </div>

      <div className="min-w-0">
        <p className={cn("text-sm truncate", isCurrent && "text-primary")}>
          {track.name}
        </p>
        <p className="text-xs text-text-muted truncate">
          {track.artists.map((a) => a.name).join(" / ")}
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

export const QueuePanel = () => {
  const { queue, currentTrack, playFromIndex, removeFromQueue, clearQueue } =
    usePlayerStore(
      useShallow((s) => ({
        queue: s.queue,
        currentTrack: s.currentTrack,
        playFromIndex: s.playFromIndex,
        removeFromQueue: s.removeFromQueue,
        clearQueue: s.clearQueue,
      })),
    );
  const { opened, close } = useQueuePanelStore(
    useShallow((s) => ({
      opened: s.opened,
      close: s.close,
    })),
  );
  const [visible, setVisible] = useState(false);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const virtuosoRef = useRef<VirtuosoHandle>(null);

  useEffect(() => {
    if (opened) {
      setVisible(true);
    }
  }, [opened]);

  const handleClose = () => {
    setVisible(false);
  };

  const handleTransitionEnd = () => {
    if (!visible) {
      close();
    }
  };

  const handlePlayTrack = (index: number) => {
    playFromIndex(index);
  };

  const handleRemove = (index: number) => {
    removeFromQueue(index);
  };

  const handleClear = () => {
    clearQueue();
    setClearConfirmOpen(false);
    toast.success("播放列表已清空");
  };

  const currentIndex = currentTrack
    ? queue.findIndex((item) => item.id === currentTrack.id)
    : -1;

  const scrollToCurrent = useCallback(() => {
    if (currentIndex >= 0) {
      setTimeout(() => {
        virtuosoRef.current?.scrollToIndex({
          index: currentIndex,
          align: "center",
        });
      }, 50);
    }
  }, [currentIndex]);

  if (!opened) return null;

  return (
    <div className="isolate fixed inset-0 z-50 flex justify-end">
      <button
        aria-label="关闭播放列表"
        className="absolute inset-0 cursor-default"
        onClick={handleClose}
        type="button"
      />

      <aside
        className={cn(
          "relative w-80 h-full bg-white dark:bg-black shadow-xl dark:shadow-black/30 flex flex-col z-10 transition-transform duration-300 ease-out",
          visible ? "translate-x-0" : "translate-x-full",
        )}
        onTransitionEnd={handleTransitionEnd}
      >
        <header className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <h2 className="text-sm font-medium">
            播放列表
            {queue.length > 0 && (
              <span className="ml-1.5 text-xs text-text-muted">
                ({queue.length})
              </span>
            )}
          </h2>
          <div className="flex items-center gap-1">
            {queue.length > 0 && (
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
          <div
            className={cn(
              "absolute inset-0 flex flex-col items-center justify-center gap-2 text-text-muted transition-all duration-300",
              queue.length === 0
                ? "opacity-100 scale-100"
                : "opacity-0 scale-95 pointer-events-none",
            )}
          >
            <Music className="size-10 opacity-30" />
            <p className="text-xs">播放列表为空</p>
            <p className="text-[10px] opacity-60">双击歌曲即可加入队列</p>
          </div>
          <div
            className={cn(
              "h-full transition-all duration-300",
              queue.length > 0
                ? "opacity-100 translate-y-0"
                : "opacity-0 translate-y-2 pointer-events-none",
            )}
          >
            <Virtuoso
              components={{ Scroller: VirtuosoScroller }}
              computeItemKey={(index) => queue[index]?.id ?? index}
              fixedItemHeight={48}
              itemContent={(index) => (
                <QueueItem
                  index={index}
                  isCurrent={currentTrack?.id === queue[index]?.id}
                  onPlay={handlePlayTrack}
                  onRemove={handleRemove}
                  track={queue[index]}
                />
              )}
              overscan={100}
              ref={(ref) => {
                virtuosoRef.current = ref;
                if (ref && currentIndex >= 0) scrollToCurrent();
              }}
              style={{ height: "100%" }}
              totalCount={queue.length}
            />
          </div>
        </div>
      </aside>

      <Dialog onOpenChange={setClearConfirmOpen} open={clearConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>清空播放列表</DialogTitle>
            <DialogDescription>
              确定要清空播放列表吗？此操作不可撤销。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setClearConfirmOpen(false)} variant="outline">
              取消
            </Button>
            <Button onClick={handleClear}>确定</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
