import { Music, Trash2 } from "lucide-react";
import { useCallback, useRef } from "react";
import type { VirtuosoHandle } from "react-virtuoso";
import { Virtuoso } from "react-virtuoso";
import { ImageWithFade } from "@/components/ui/image";
import { VirtuosoScroller } from "@/components/virtuoso/VirtuosoScroller";
import { cn } from "@/lib/utils";
import { usePlayerStore } from "@/stores";

function QueueItem({
  track,
  index,
  isCurrent,
  onPlay,
  onRemove,
}: {
  track: ReturnType<typeof usePlayerStore.getState>["queue"][number];
  index: number;
  isCurrent: boolean;
  onPlay: (index: number) => void;
  onRemove: (index: number) => void;
}) {
  return (
    <div
      className={cn(
        "group flex items-center gap-3 px-2 py-2 w-full text-left cursor-pointer transition-colors hover:bg-accent rounded-md",
        isCurrent && "bg-primary/10",
      )}
      onDoubleClick={() => onPlay(index)}
      onKeyDown={() => onPlay(index)}
      role="option"
      tabIndex={0}
    >
      <div className="w-9 h-9 rounded bg-secondary flex items-center justify-center shrink-0 overflow-hidden">
        {track.album?.picUrl ? (
          <ImageWithFade
            alt={track.album.name}
            className="object-cover"
            fill
            src={track.album.picUrl}
          />
        ) : (
          <Music className="size-4 text-muted-foreground" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className={cn("text-sm truncate", isCurrent && "text-primary")}>
          {track.name}
        </p>
        <p className="text-xs text-muted-foreground truncate">
          {track.artists?.map((a) => a.name).join(" / ") || " "}
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
}

export function PlayerPageQueue() {
  const queue = usePlayerStore((s) => s.queue);
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const removeFromQueue = usePlayerStore((s) => s.removeFromQueue);
  const playFromIndex = usePlayerStore((s) => s.playFromIndex);
  const virtuosoRef = useRef<VirtuosoHandle>(null);

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

  return (
    <div className="h-full w-full flex flex-col">
      <header className="flex items-center justify-between px-2 py-3 shrink-0">
        <h2 className="text-sm font-medium">
          播放列表
          {queue.length > 0 && (
            <span className="ml-1.5 text-xs text-muted-foreground">
              ({queue.length})
            </span>
          )}
        </h2>
      </header>

      {queue.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-2 text-muted-foreground">
          <Music className="size-10 opacity-30" />
          <p className="text-xs">播放列表为空</p>
          <p className="text-[10px] opacity-60">双击歌曲即可加入队列</p>
        </div>
      ) : (
        <div className="flex-1 px-2 py-1">
          <Virtuoso
            components={{ Scroller: VirtuosoScroller }}
            computeItemKey={(index) => queue[index]?.id ?? index}
            fixedItemHeight={48}
            itemContent={(index) => (
              <QueueItem
                index={index}
                isCurrent={currentTrack?.id === queue[index]?.id}
                onPlay={playFromIndex}
                onRemove={removeFromQueue}
                track={queue[index]}
              />
            )}
            overscan={50}
            ref={(ref) => {
              virtuosoRef.current = ref;
              if (ref && currentIndex >= 0) scrollToCurrent();
            }}
            style={{ height: "100%" }}
            totalCount={queue.length}
          />
        </div>
      )}
    </div>
  );
}
