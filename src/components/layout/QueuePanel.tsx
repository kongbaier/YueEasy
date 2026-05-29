import { Music, Trash2, X } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import type { VirtuosoHandle } from "react-virtuoso";
import { Virtuoso } from "react-virtuoso";
import { Button } from "@/components/ui/button";
import { VirtuosoScroller } from "@/components/virtuoso/VirtuosoScroller";
import type { Track } from "@/core/player/types";
import { useQueuePanel } from "@/hooks/use-queue-panel";
import { cn } from "@/lib/cn";
import { usePlayerStore } from "@/stores";

function QueueItem({
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
}) {
  return (
    <button
      className={cn(
        "group flex items-center gap-3 px-4 py-2.5 w-full text-left cursor-pointer transition-colors hover:bg-surface-hover",
        isCurrent && "bg-primary/10",
      )}
      onDoubleClick={() => onPlay(index)}
      tabIndex={0}
      type="button"
    >
      <div className="w-8 h-8 rounded bg-surface flex items-center justify-center shrink-0 overflow-hidden">
        {track.album.picUrl ? (
          <img
            alt={track.album.name}
            className="w-full h-full object-cover"
            src={track.album.picUrl}
          />
        ) : (
          <Music className="size-3.5 text-text-muted" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className={cn("text-sm truncate", isCurrent && "text-primary")}>
          {track.name}
        </p>
        <p className="text-xs text-text-muted truncate">
          {track.artists.map((a) => a.name).join(" / ")}
        </p>
      </div>

      <Button
        className="opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={(e: React.MouseEvent) => {
          e.stopPropagation();
          onRemove(index);
        }}
        type="button"
        variant="default"
      >
        <Trash2 className="size-4" />
      </Button>
    </button>
  );
}

export function QueuePanel() {
  const queue = usePlayerStore((s) => s.queue);
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const playFromIndex = usePlayerStore((s) => s.playFromIndex);
  const removeFromQueue = usePlayerStore((s) => s.removeFromQueue);
  const { open, animating, closePanel, finishClose } = useQueuePanel();
  const [closing, setClosing] = useState(false);
  const virtuosoRef = useRef<VirtuosoHandle>(null);

  const handleClose = () => {
    setClosing(true);
    closePanel();
  };

  const handleTransitionEnd = () => {
    if (closing) {
      setClosing(false);
      finishClose();
    }
  };

  const handlePlayTrack = (index: number) => {
    playFromIndex(index);
  };

  const handleRemove = (index: number) => {
    removeFromQueue(index);
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

  if (!open) return null;

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
          "relative w-80 h-full bg-white dark:bg-black shadow-xl flex flex-col z-10 transition-transform duration-300 ease-out",
          animating ? "translate-x-0" : "translate-x-full",
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
          <Button onClick={handleClose} type="button" variant="default">
            <X className="size-4" />
          </Button>
        </header>

        {queue.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-2 text-text-muted">
            <Music className="size-10 opacity-30" />
            <p className="text-xs">播放列表为空</p>
            <p className="text-[10px] opacity-60">双击歌曲即可加入队列</p>
          </div>
        ) : (
          <div className="flex-1">
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
        )}
      </aside>
    </div>
  );
}
