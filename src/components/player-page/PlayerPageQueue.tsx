import { Music, Trash2 } from "lucide-react";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { usePlayerStore } from "@/stores";

function QueueItem({
  track,
  isCurrent,
  onPlay,
  onRemove,
}: {
  track: ReturnType<typeof usePlayerStore.getState>["queue"][number];
  isCurrent: boolean;
  onPlay: () => void;
  onRemove: () => void;
}) {
  return (
    <button
      className={cn(
        "group flex items-center gap-3 px-2 py-2 w-full text-left cursor-pointer transition-colors hover:bg-accent rounded-md",
        isCurrent && "bg-primary/10",
      )}
      onClick={onPlay}
      type="button"
    >
      <div className="w-9 h-9 rounded bg-secondary flex items-center justify-center shrink-0 overflow-hidden">
        {track.album?.picUrl ? (
          <img
            alt={track.album.name}
            className="w-full h-full object-cover"
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
          onRemove();
        }}
        type="button"
      >
        <Trash2 className="size-3.5" />
      </button>
    </button>
  );
}

export function PlayerPageQueue() {
  const queue = usePlayerStore((s) => s.queue);
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const removeFromQueue = usePlayerStore((s) => s.removeFromQueue);
  const play = usePlayerStore((s) => s.play);
  const listRef = useRef<HTMLDivElement>(null);

  const currentIndex = currentTrack
    ? queue.findIndex((item) => item.id === currentTrack.id)
    : -1;

  useEffect(() => {
    if (currentIndex >= 0 && listRef.current) {
      const item = listRef.current.children[currentIndex] as
        | HTMLElement
        | undefined;
      item?.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }, [currentIndex]);

  return (
    <div className="h-full flex flex-col">
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
        <div className="flex-1 overflow-y-auto" ref={listRef}>
          {queue.map((track, index) => (
            <QueueItem
              isCurrent={currentTrack?.id === track.id}
              key={track.id}
              onPlay={() => play(track)}
              onRemove={() => removeFromQueue(index)}
              track={track}
            />
          ))}
        </div>
      )}
    </div>
  );
}
