import {
  ChevronFirst,
  ChevronLast,
  ListMusic,
  Loader2,
  Music,
  Pause,
  Play,
  ThumbsDown,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/shared/ui/button";
import { FollowTooltip } from "@/modules/player/components/FollowTooltip";
import { useMediaSession } from "@/modules/player/hooks/useMediaSession";
import { usePlaybackClock } from "@/modules/player/hooks/usePlaybackClock";
import { usePlayerKeyboard } from "@/modules/player/hooks/usePlayerKeyboard";
import { useProgress } from "@/modules/player/hooks/useProgress";
import { usePlayer } from "@/modules/player/hooks/usePlayer";
import { formatDuration } from "@/shared/utils/format";
import { toast } from "@/shared/lib/toast";
import { cn } from "@/shared/utils/cn";
import { getNcmImageUrl } from "@/shared/utils/image";
import { formatQueueCount } from "@/shared/utils/format";
import { usePlayerPage } from "@/modules/player/contexts/PlayerPageContext";
import { RepeatButton } from "./RepeatButton";
import { ShuffleButton } from "./ShuffleButton";
import { SeekBar } from "./SeekBar";
import { VolumeControl } from "./VolumeControl";
import { Cover } from "@/shared/ui/image";
import type { Track } from "@/shared/types/player";
import { LikeButton } from "@/modules/like/components/LikeButton";

const PlayerProgress = () => {
  const { percentage, formatted } = useProgress();
  const { seek, duration } = usePlayer();

  return (
    <SeekBar
      barClassName="w-full h-1 group-hover:h-1.5 bg-surface-hover relative select-none"
      className="absolute w-full -top-1.5 left-0 h-3  cursor-pointer flex items-center group"
      duration={duration}
      onSeek={seek}
      percentage={percentage}
    >
      {({
        displayPercentage,
        barRef,
        isHovering,
        hoverBarX,
        hoverPercentage,
      }) => {
        const hoverTime =
          hoverPercentage !== null && duration > 0
            ? (hoverPercentage / 100) * duration
            : 0;
        return (
          <>
            <div
              className="h-full bg-primary rounded-r-full"
              style={{ width: `${displayPercentage}%` }}
            />
            <FollowTooltip anchorRef={barRef} open={isHovering} x={hoverBarX}>
              <span className="inline-block min-w-[11ch] text-center">
                <span className="text-primary">
                  {formatDuration(hoverTime)}
                </span>
                /{formatted.duration}
              </span>
            </FollowTooltip>
          </>
        );
      }}
    </SeekBar>
  );
};

const PlayIcon = ({
  loading,
  playing,
}: {
  loading: boolean;
  playing: boolean;
}) => {
  if (loading) {
    return <Loader2 className="size-4 animate-spin text-primary-foreground" />;
  }
  if (playing) {
    return <Pause className="size-4 text-primary-foreground" />;
  }
  return <Play className="size-4 text-primary-foreground" />;
};

const PlayerControls = () => {
  const { togglePlay, next, prev, playing, loading, currentTrack, canPrev } =
    usePlayer();
  const hasTrack = !!currentTrack;
  return (
    <article className="flex items-center gap-x-6">
      <section className="flex items-center gap-x-1">
        <RepeatButton />
      </section>
      <section
        className={cn(
          "flex text-4xl gap-x-3 justify-center items-center-safe transition-opacity duration-300",
          !hasTrack && "opacity-30 pointer-events-none",
        )}
      >
        <Button
          className="text-foreground hover:bg-transparent hover:text-primary"
          disabled={!canPrev}
          onClick={prev}
          size="icon"
          variant="ghost"
        >
          <ChevronFirst className="size-4.5" />
        </Button>

        <Button
          className="relative w-14 h-9 bg-primary rounded-full flex justify-center items-center cursor-pointer focus:outline-none"
          disabled={loading}
          onClick={togglePlay}
          type="button"
        >
          <PlayIcon loading={loading} playing={playing} />
        </Button>

        <Button
          className="text-foreground hover:bg-transparent hover:text-primary"
          onClick={next}
          size="icon"
          variant="ghost"
        >
          <ChevronLast className="size-4.5" />
        </Button>
      </section>
      <section className="flex items-center">
        <VolumeControl />
      </section>
    </article>
  );
};

const PlayerInfo = ({ currentTrack }: { currentTrack: Track | null }) => {
  const { open: openPlayerPage } = usePlayerPage();

  return (
    <div className="flex-1 min-w-0 relative flex items-center">
      <div
        className={cn(
          "flex items-center gap-3 transition-all duration-300",
          !currentTrack
            ? "opacity-100"
            : "opacity-0 pointer-events-none absolute inset-0",
        )}
      >
        <div className="flex items-center justify-center size-10 shrink-0 rounded-md bg-accent/40 ring-1 ring-border/40">
          <Music className="size-4 text-muted-foreground/60" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-muted-foreground/70">
            暂无歌曲
          </p>
          <p className="truncate text-xs text-muted-foreground/50">
            听听音乐吧
          </p>
        </div>
      </div>

      <div
        className={cn(
          "flex items-center gap-3 min-w-0 transition-all duration-300",
          currentTrack
            ? "opacity-100"
            : "opacity-0 pointer-events-none absolute inset-0",
        )}
      >
        <button
          className={cn(
            "size-10 shrink-0 transition-colors",
            "transition-transform duration-100 origin-bottom-left hover:brightness-95 hover:scale-110",
          )}
          onClick={openPlayerPage}
          type="button"
        >
          {currentTrack?.album.picUrl ? (
            <Cover
              className="size-full"
              foregroundClassName="rounded-md border-[0.5px]  border-border"
              alt={currentTrack.album.name}
              src={getNcmImageUrl(currentTrack.album.picUrl, 50)}
            />
          ) : (
            <div className="flex items-center justify-center size-full bg-accent">
              <Music className="size-4 text-muted-foreground/60" />
            </div>
          )}
        </button>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">
            {currentTrack?.name ?? ""}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {currentTrack?.artists?.map((a) => a.name).join("/") || " "}
          </p>
        </div>
      </div>
    </div>
  );
};

const PlayerMenu = ({
  onToggleQueuePanel,
}: {
  onToggleQueuePanel: () => void;
}) => {
  const { currentTrack, queueLength, isFm, fmTrash } = usePlayer();
  const [trashPending, setTrashPending] = useState(false);

  const handleFmTrash = async () => {
    if (trashPending) return;
    setTrashPending(true);
    try {
      await fmTrash();
      toast.success("已减少此类推荐");
    } catch {
      toast.error("操作失败，请重试");
    } finally {
      setTrashPending(false);
    }
  };

  return (
    <div className="flex-1 flex items-center justify-end gap-1 lg:gap-2">
      {currentTrack && <LikeButton iconSize={4.5} track={currentTrack} />}
      <ShuffleButton iconSize={4.5} />
      <Button
        className="text-foreground hover:bg-transparent hover:text-primary"
        disabled={trashPending}
        onClick={isFm ? handleFmTrash : onToggleQueuePanel}
        size="icon"
        title={isFm ? "不感兴趣" : undefined}
        variant="ghost"
      >
        {isFm ? (
          trashPending ? (
            <Loader2 className="size-4.5 animate-spin" />
          ) : (
            <ThumbsDown className="size-4.5" />
          )
        ) : (
          <span className="relative">
            <ListMusic className="size-4.5" />
            {queueLength > 0 && (
              <span className="absolute -top-1 -right-1.5 text-[9px] font-medium tabular-nums">
                {formatQueueCount(queueLength)}
              </span>
            )}
          </span>
        )}
      </Button>
    </div>
  );
};

export const PlayerBar = ({
  className,
  onToggleQueuePanel,
}: {
  className?: string;
  onToggleQueuePanel: () => void;
}) => {
  usePlayerKeyboard();
  useMediaSession();
  usePlaybackClock();
  const { currentTrack } = usePlayer();
  return (
    <div
      className={cn(
        "relative bg-card px-4 flex items-center justify-between",
        className,
      )}
    >
      <PlayerProgress />

      <PlayerInfo currentTrack={currentTrack} />

      <PlayerControls />

      <PlayerMenu onToggleQueuePanel={onToggleQueuePanel} />
    </div>
  );
};
