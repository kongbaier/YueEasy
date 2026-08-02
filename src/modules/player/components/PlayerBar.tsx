import {
  ChevronFirst,
  ChevronLast,
  Heart,
  ListMusic,
  Loader2,
  Music,
  Pause,
  Play,
} from "lucide-react";
import { useCallback } from "react";
import { Button } from "@/shared/ui/button";
import { FollowTooltip } from "@/modules/player/components/FollowTooltip";
import { useMediaSession } from "@/modules/player/hooks/useMediaSession";
import { usePlayerAction } from "@/modules/player/hooks/usePlayerAction";
import { usePlayerKeyboard } from "@/modules/player/hooks/usePlayerKeyboard";
import { useProgress } from "@/modules/player/hooks/useProgress";
import { formatDuration } from "@/shared/utils/format";
import { toast } from "@/shared/lib/toast";
import { cn } from "@/shared/lib/utils";
import { ncm } from "@/tauri/ncm";
import { formatQueueCount, useQueueStore } from "@/modules/player/stores/queue";
import { useLoginDialog } from "@/modules/auth/loginDialogStore";
import { usePlayerPage } from "@/modules/player/contexts/PlayerPageContext";
import { PlayModeControl } from "./PlayModeControl";
import { SeekBar } from "./SeekBar";
import { VolumeControl } from "./VolumeControl";
import { Cover } from "@/shared/ui/image";
import { usePlayerStore } from "../stores/player";
import { useAuthStore } from "@/stores/auth";
import { useLikeStore } from "@/stores/like";

const PlayerProgress = () => {
  const { percentage, formatted } = useProgress();
  const seek = usePlayerStore((s) => s.seek);
  const duration = usePlayerStore((s) => s.duration);

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
  const { handlePlay, handleNext, handlePrev } = usePlayerAction();
  const loading = usePlayerStore((s) => s.loading);
  const playing = usePlayerStore((s) => s.playing);
  const currentTrack = useQueueStore((s) => s.currentTrack);
  const hasTrack = !!currentTrack;
  return (
    <article className="flex items-center gap-x-6">
      <section className="flex items-center">
        <PlayModeControl />
      </section>
      <section
        className={cn(
          "flex text-4xl gap-x-3 justify-center items-center-safe transition-opacity duration-300",
          !hasTrack && "opacity-30 pointer-events-none",
        )}
      >
        <Button
          className="text-foreground hover:bg-transparent hover:text-primary"
          onClick={handlePrev}
          size="icon"
          variant="ghost"
        >
          <ChevronFirst className="size-5" />
        </Button>

        <Button
          className="relative w-12 h-8 bg-primary rounded-2xl flex justify-center items-center cursor-pointer focus:outline-none"
          disabled={loading}
          onClick={handlePlay}
          type="button"
        >
          <PlayIcon loading={loading} playing={playing} />
        </Button>

        <Button
          className="text-foreground hover:bg-transparent hover:text-primary"
          onClick={handleNext}
          size="icon"
          variant="ghost"
        >
          <ChevronLast className="size-5" />
        </Button>
      </section>
      <section className="flex items-center">
        <VolumeControl />
      </section>
    </article>
  );
};

const PlayerInfo = () => {
  const currentTrack = useQueueStore((s) => s.currentTrack);
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
            "rounded-md overflow-hidden shadow-sm dark:shadow-none dark:ring-1 dark:ring-white/10 size-10 shrink-0 transition-colors",
            "transition-transform duration-100 origin-bottom-left hover:brightness-95 hover:scale-110",
          )}
          onClick={openPlayerPage}
          type="button"
        >
          {currentTrack?.album.picUrl ? (
            <Cover
              className="size-full"
              alt={currentTrack.album.name}
              src={currentTrack.album.picUrl}
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
  const queueLength = useQueueStore((s) => s.queueLength);
  const currentTrack = useQueueStore((s) => s.currentTrack);
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const setLoginDialogOpen = useLoginDialog((s) => s.setOpen);
  const isLiked = useLikeStore((s) =>
    currentTrack ? s.isLiked(currentTrack.id) : false,
  );
  const toggleLike = useLikeStore((s) => s.toggle);

  const handleLike = useCallback(() => {
    if (!currentTrack) return;
    if (!isLoggedIn) {
      toast.error("请先登录");
      setLoginDialogOpen(true);
      return;
    }
    const next = !isLiked;
    toggleLike(currentTrack.id);
    ncm
      .like(currentTrack.id, next)
      .then(() => {
        toast.success(
          next
            ? `已收藏 ${currentTrack.name}`
            : `已取消收藏 ${currentTrack.name}`,
        );
      })
      .catch(() => {
        toggleLike(currentTrack.id);
        toast.error("操作失败，请重试");
      });
  }, [isLoggedIn, isLiked, currentTrack, toggleLike, setLoginDialogOpen]);

  return (
    <div className="flex-1 flex items-center justify-end">
      {currentTrack && (
        <Button
          className="text-foreground hover:bg-transparent hover:text-primary"
          onClick={handleLike}
          size="icon"
          variant="ghost"
        >
          <Heart className="size-4" fill={isLiked ? "#ef4444" : "none"} />
        </Button>
      )}
      <Button
        className="text-foreground hover:bg-transparent hover:text-primary"
        onClick={onToggleQueuePanel}
        size="icon"
        variant="ghost"
      >
        <span className="relative">
          <ListMusic className="size-4" />
          {queueLength > 0 && (
            <span className="absolute -top-1 -right-1.5 text-[9px] font-medium tabular-nums">
              {formatQueueCount(queueLength)}
            </span>
          )}
        </span>
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
  return (
    <div
      className={cn(
        "relative bg-card px-4 flex items-center justify-between",
        className,
      )}
    >
      <PlayerProgress />

      <PlayerInfo />

      <PlayerControls />

      <PlayerMenu onToggleQueuePanel={onToggleQueuePanel} />
    </div>
  );
};
