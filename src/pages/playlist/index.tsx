import { Play } from "lucide-react";
import { Suspense, useState } from "react";
import { useParams } from "react-router-dom";
import { CommentPanel, CommentSkeleton } from "@/modules/comment/components";
import { Cover } from "@/shared/ui/image";
import { usePageTitle } from "@/app/layout/PageTitleContext";
import { TrackRow, TrackRowSkeleton } from "@/shared/ui/track";
import { Button } from "@/shared/ui/button";
import { Skeleton } from "@/shared/ui/skeleton";
import { formatCount } from "@/shared/utils/format";
import { cn } from "@/shared/utils/cn";
import { getNcmImageUrl } from "@/shared/utils/image";
import { usePlaylistViewModel } from "./usePlaylistViewModel";

/* ------------------------------------------------------------------ */
/*  工具                                                               */
/* ------------------------------------------------------------------ */

const formatDate = (ts: number) => {
  const d = new Date(ts);
  return `${d.getFullYear()}年${d.getMonth() + 1}月`;
};

/* ------------------------------------------------------------------ */
/*  Tab 切换                                                            */
/* ------------------------------------------------------------------ */

type TabKey = "songs" | "comments";

const TABS: { key: TabKey; label: string }[] = [
  { key: "songs", label: "歌曲" },
  { key: "comments", label: "评论" },
];

interface TabBarProps {
  active: TabKey;
  onChange: (key: TabKey) => void;
  songCount?: number;
  commentCount?: number;
}

const TabBar = ({ active, onChange, songCount, commentCount }: TabBarProps) => (
  <div className="flex border-b border-border/40">
    {TABS.map((tab) => {
      const count = tab.key === "songs" ? songCount : commentCount;
      const showCount =
        tab.key === "songs" ? count != null : count != null && count > 0;
      return (
        <Button
          className={cn(
            "px-2 text-[17px] py-3 font-medium transition-colors",
            active === tab.key
              ? "text-foreground font-medium"
              : "text-muted-foreground hover:text-foreground/80",
          )}
          key={tab.key}
          onClick={() => onChange(tab.key)}
          variant="ghost"
        >
          <span className="flex items-start gap-1">
            <span className="relative leading-none">
              {tab.label}
              {active === tab.key && (
                <span className="absolute left-1/2 -translate-x-1/2 -bottom-1.75 w-5 h-0.5 bg-primary rounded-full" />
              )}
            </span>
            {showCount && count != null && (
              <span className="text-[9px] leading-none tabular-nums text-muted-foreground/70">
                {formatCount(count)}
              </span>
            )}
          </span>
        </Button>
      );
    })}
  </div>
);

/* ------------------------------------------------------------------ */
/*  骨架屏                                                             */
/* ------------------------------------------------------------------ */

const PlaylistSkeleton = () => (
  <div className="py-8 px-4 space-y-8">
    {/* Header */}
    <div className="flex gap-8 items-center">
      <Skeleton className="h-56 w-56 shrink-0 rounded-2xl" shimmer />
      <div className="flex-1 min-w-0 space-y-4">
        <Skeleton className="h-9 w-64 rounded" shimmer />
        <div className="flex gap-1.5">
          <Skeleton className="h-5 w-12 rounded-md" shimmer />
          <Skeleton className="h-5 w-14 rounded-md" shimmer />
          <Skeleton className="h-5 w-10 rounded-md" shimmer />
        </div>
        <Skeleton className="h-4 w-44 rounded" shimmer />
        <div className="flex gap-5">
          <Skeleton className="h-4 w-14 rounded" shimmer />
          <Skeleton className="h-4 w-12 rounded" shimmer />
        </div>
        <div className="pt-1">
          <Skeleton className="h-9 w-28 rounded-md" shimmer />
        </div>
      </div>
    </div>

    {/* Tab bar */}
    <TabBar active="songs" onChange={() => {}} />

    {/* Track list */}
    <div className="space-y-0.5">
      <div className="flex items-center gap-3 px-3 pb-3 border-b border-border/30 mb-2">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          歌曲列表
        </span>
      </div>
      {Array.from({ length: 8 }).map((_, i) => (
        // oxlint-disable-next-line react/no-array-index-key
        <TrackRowSkeleton index={i} key={i} />
      ))}
    </div>
  </div>
);

/* ------------------------------------------------------------------ */
/*  页面主体                                                            */
/* ------------------------------------------------------------------ */

interface PlaylistProps {
  /** 外部显式传入的歌单 id（如「我喜欢」复用场景）；缺省时回退路由参数 :id */
  playlistId?: number;
}

const PlaylistContent = ({ playlistId }: PlaylistProps) => {
  const { id } = useParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState<TabKey>("songs");

  const resolvedId = playlistId ?? Number(id);

  if (!resolvedId) throw new Error("无效的歌单 ID");

  const { playlist, fromCache, visibleCount, handlePlay, handlePlayAll } =
    usePlaylistViewModel(resolvedId);
  usePageTitle(playlist.name);

  /* 构建元信息行 */
  const metaParts: string[] = [];
  metaParts.push(`${formatCount(playlist.playCount)}次播放`);
  if (playlist.subscribedCount != null && playlist.subscribedCount > 0) {
    metaParts.push(`${formatCount(playlist.subscribedCount)}收藏`);
  }
  if (playlist.creator) metaParts.push(playlist.creator.nickname);
  if (playlist.createTimeMs)
    metaParts.push(`${formatDate(playlist.createTimeMs)}创建`);
  if (
    playlist.updateTimeMs &&
    playlist.updateTimeMs !== playlist.createTimeMs
  ) {
    metaParts.push(`${formatDate(playlist.updateTimeMs)}更新`);
  }

  return (
    <div className="py-8 pl-8 pr-4 space-y-8">
      {/* ═══ Header ═══ */}
      <div className="flex gap-8">
        {/* 封面 */}
        {playlist.coverUrl && (
          <Cover
            alt={playlist.name}
            className="size-48 shrink-0"
            foregroundClassName="rounded-2xl shadow-lg shadow-black/10 dark:shadow-black/30"
            src={getNcmImageUrl(playlist.coverUrl, 400)}
          />
        )}

        {/* 元数据 */}
        <div className="flex-1 min-w-0 flex flex-col justify-between">
          <div className="space-y-3">
            <h1 className="text-2xl font-bold tracking-tight truncate">
              {playlist.name}
            </h1>

            {/* 标签 */}
            {playlist.tags && playlist.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {playlist.tags.map((tag) => (
                  <span
                    className="px-2.5 py-0.5 rounded-md text-xs font-medium border border-primary/20 text-primary/80"
                    key={tag}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}

            <p className="text-sm text-muted-foreground line-clamp-2">
              {playlist.description}
            </p>

            {metaParts.length > 0 && (
              <p className="text-sm text-muted-foreground/80 truncate">
                {metaParts.join("  ·  ")}
              </p>
            )}
          </div>

          {/* 操作按钮 */}
          <div className="flex items-center gap-3 pt-1">
            <Button
              className="h-auto py-2 rounded-lg"
              onClick={handlePlayAll}
              variant="default"
              size="default"
            >
              <Play className="size-3.5" />
              播放全部
            </Button>
            {fromCache && (
              <span className="text-xs text-muted-foreground/70 bg-muted px-2 py-0.5 rounded">
                缓存数据
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <TabBar
          active={activeTab}
          commentCount={playlist.commentCount}
          onChange={setActiveTab}
          songCount={playlist.trackCount}
        />
        {activeTab === "songs" ? (
          /* 歌曲列表 */
          playlist.tracks &&
          playlist.tracks.length > 0 && (
            <div className="space-y-0.5">
              {playlist.tracks.slice(0, visibleCount).map((track, index) => (
                <TrackRow
                  index={index}
                  key={track.id}
                  onPlay={handlePlay}
                  track={track}
                />
              ))}
            </div>
          )
        ) : (
          /* 评论面板 */
          <Suspense fallback={<CommentSkeleton />}>
            <CommentPanel playlistId={playlist.id} />
          </Suspense>
        )}
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  导出                                                               */
/* ------------------------------------------------------------------ */

export default function Playlist({ playlistId }: PlaylistProps) {
  return (
    <Suspense fallback={<PlaylistSkeleton />}>
      <PlaylistContent playlistId={playlistId} />
    </Suspense>
  );
}
