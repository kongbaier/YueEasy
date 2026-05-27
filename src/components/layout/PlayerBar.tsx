import {
  Pause,
  Play,
  Repeat,
  Shuffle,
  SkipBack,
  SkipForward,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { formatDuration } from "@/lib/format";
import { usePlayerStore } from "@/stores";

export function PlayerBar({ className }: { className?: string }) {
  const {
    currentTrack,
    state,
    mode,
    currentTime,
    duration,
    pause,
    resume,
    next,
    prev,
    setMode,
  } = usePlayerStore();

  if (!currentTrack) {
    return (
      <div
        className={cn(
          "flex h-16 items-center justify-center border-t border-border bg-card text-sm text-muted-foreground",
          className,
        )}
      >
        未在播放
      </div>
    );
  }

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className={cn("border-t border-border bg-card px-4 pb-2", className)}>
      <div className="h-1 w-full bg-secondary">
        <div
          className="h-full bg-primary transition-[width] duration-100 ease-linear"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="flex items-center gap-4 pt-2">
        <div className="flex w-48 min-w-0 items-center gap-3">
          <div className="h-10 w-10 shrink-0 rounded bg-secondary" />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{currentTrack.name}</p>
            <p className="truncate text-xs text-muted-foreground">
              {currentTrack.artists?.map((a) => a.name).join("/")}
            </p>
          </div>
        </div>

        <div className="flex flex-1 flex-col items-center gap-0.5">
          <div className="flex items-center gap-2">
            <button
              className={cn(
                "rounded p-1 transition-colors hover:text-foreground",
                mode === "shuffle" ? "text-primary" : "text-muted-foreground",
              )}
              onClick={() =>
                setMode(mode === "shuffle" ? "sequential" : "shuffle")
              }
              title="随机播放"
              type="button"
            >
              <Shuffle className="h-4 w-4" />
            </button>

            <button
              className="rounded p-1 text-muted-foreground transition-colors hover:text-foreground"
              onClick={prev}
              title="上一首"
              type="button"
            >
              <SkipBack className="h-5 w-5" />
            </button>

            <button
              className="rounded-full bg-primary p-2 text-primary-foreground transition-transform hover:scale-105 active:scale-95"
              onClick={state === "playing" ? pause : resume}
              type="button"
            >
              {state === "playing" ? (
                <Pause className="h-5 w-5" />
              ) : (
                <Play className="h-5 w-5" />
              )}
            </button>

            <button
              className="rounded p-1 text-muted-foreground transition-colors hover:text-foreground"
              onClick={next}
              title="下一首"
              type="button"
            >
              <SkipForward className="h-5 w-5" />
            </button>

            <button
              className={cn(
                "rounded p-1 transition-colors hover:text-foreground",
                mode === "repeat" || mode === "repeatOne"
                  ? "text-primary"
                  : "text-muted-foreground",
              )}
              onClick={() =>
                setMode(
                  mode === "repeatOne"
                    ? "repeat"
                    : mode === "repeat"
                      ? "sequential"
                      : "repeat",
                )
              }
              title="循环模式"
              type="button"
            >
              <Repeat className="h-4 w-4" />
            </button>
          </div>

          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <span className="w-8 text-right">
              {formatDuration(currentTime)}
            </span>
            <span>/</span>
            <span className="w-8">{formatDuration(duration)}</span>
          </div>
        </div>

        <div className="w-48" />
      </div>
    </div>
  );
}
