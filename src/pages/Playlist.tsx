import { useSuspenseQuery } from "@tanstack/react-query";
import {
  ChevronDown,
  ChevronUp,
  ListMusic,
  MessageCircle,
  Play,
  Users,
} from "lucide-react";
import { Suspense, useState } from "react";
import { useParams } from "react-router-dom";
import { CommentPanel, CommentSkeleton } from "@/components/comment";
import { TrackRow, TrackRowSkeleton } from "@/components/track";
import { Button } from "@/components/ui/button";
import { ImageWithFade } from "@/components/ui/image";
import { Skeleton } from "@/components/ui/skeleton";
import type { SongRef } from "@/core/playlist/types";
import { useLoadMore } from "@/hooks/useLoadMore";
import { formatCount } from "@/lib/format";
import { toast } from "@/lib/toast";
import { cn, getNcmImageUrl } from "@/lib/utils";
import { getPlaylistDetail } from "@/services/playlist";
import { usePlayerStore } from "@/stores";

/* ------------------------------------------------------------------ */
/*  工具                                                               */
/* ------------------------------------------------------------------ */

const formatDate = (ts: number) => {
  const d = new Date(ts);
  return `${d.getFullYear()}年${d.getMonth() + 1}月`;
};

/* ------------------------------------------------------------------ */
/*  Tab 切换                                                           */
/* ------------------------------------------------------------------ */

type TabKey = "songs" | "comments";

const TABS: { key: TabKey; label: string }[] = [
  { key: "songs", label: "歌曲" },
  { key: "comments", label: "评论" },
];

interface TabBarProps {
  active: TabKey;
  onChange: (key: TabKey) => void;
}

const TabBar = ({ active, onChange }: TabBarProps) => (
  <div className="flex rounded-lg bg-muted p-0.5 w-fit">
    {TABS.map((tab) => (
      <button
        className={cn(
          "px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-150",
          active === tab.key
            ? "bg-card text-foreground shadow-sm ring-1 ring-border/20"
            : "text-muted-foreground hover:text-foreground",
        )}
        key={tab.key}
        onClick={() => onChange(tab.key)}
        type="button"
      >
        {tab.label}
      </button>
    ))}
  </div>
);

/* ------------------------------------------------------------------ */
/*  骨架屏                                                             */
/* ------------------------------------------------------------------ */

const PlaylistSkeleton = () => {
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex gap-6">
        <Skeleton className="h-52 w-52 shrink-0 rounded-xl" shimmer />
        <div className="flex-1 min-w-0 space-y-3 pt-1">
          <Skeleton className="h-8 w-56 rounded" shimmer />
          <Skeleton className="h-4 w-36 rounded" shimmer />
          <div className="flex gap-1.5">
            <Skeleton className="h-5 w-12 rounded-md" shimmer />
            <Skeleton className="h-5 w-14 rounded-md" shimmer />
            <Skeleton className="h-5 w-10 rounded-md" shimmer />
          </div>
          <div className="flex gap-5">
            <Skeleton className="h-4 w-20 rounded" shimmer />
            <Skeleton className="h-4 w-14 rounded" shimmer />
            <Skeleton className="h-4 w-20 rounded" shimmer />
            <Skeleton className="h-4 w-16 rounded" shimmer />
          </div>
          <div className="flex items-center gap-3 pt-0.5">
            <Skeleton className="h-9 w-28 rounded-md" shimmer />
          </div>
        </div>
      </div>

      {/* Description skeleton */}
      <div className="rounded-xl bg-card ring-1 ring-border/20 px-5 py-4 space-y-2">
        <Skeleton className="h-3 w-8 rounded" shimmer />
        <Skeleton className="h-4 w-full rounded" shimmer />
        <Skeleton className="h-4 w-3/4 rounded" shimmer />
      </div>

      {/* Tab bar */}
      <Skeleton className="h-9 w-32 rounded-lg" shimmer />

      {/* Track list */}
      <div className="space-y-0.5">
        <Skeleton className="h-4 w-16 rounded ml-3" shimmer />
        {Array.from({ length: 8 }).map((_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton array
          <TrackRowSkeleton index={i} key={i} />
        ))}
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  统计项                                                             */
/* ------------------------------------------------------------------ */

interface StatItemProps {
  icon: typeof Play;
  value: string;
  label: string;
}

const StatItem = ({ icon: Icon, value, label }: StatItemProps) => (
  <div className="flex items-baseline gap-1">
    <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0 translate-y-0.5" />
    <span className="text-sm font-medium tabular-nums">{value}</span>
    <span className="text-xs text-muted-foreground">{label}</span>
  </div>
);

/* ------------------------------------------------------------------ */
/*  描述区域                                                           */
/* ------------------------------------------------------------------ */

const DESCRIPTION_PREVIEW = 120;

const DescriptionBlock = ({ text }: { text: string }) => {
  const [expanded, setExpanded] = useState(false);
  const needsToggle = text.length > DESCRIPTION_PREVIEW;

  return (
    <div className="space-y-1">
      <p className="text-sm text-muted-foreground leading-relaxed">
        {expanded || !needsToggle
          ? text
          : `${text.slice(0, DESCRIPTION_PREVIEW)}…`}
      </p>
      {needsToggle && (
        <button
          className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary-dark transition-colors"
          onClick={() => setExpanded((v) => !v)}
          type="button"
        >
          {expanded ? "收起" : "展开"}
          {expanded ? (
            <ChevronUp className="h-3 w-3" />
          ) : (
            <ChevronDown className="h-3 w-3" />
          )}
        </button>
      )}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  页面主体                                                           */
/* ------------------------------------------------------------------ */

const PlaylistContent = () => {
  const { id } = useParams<{ id: string }>();
  const play = usePlayerStore((s) => s.play);
  const replaceAndPlay = usePlayerStore((s) => s.replaceAndPlay);
  const [activeTab, setActiveTab] = useState<TabKey>("songs");

  if (!id) throw new Error("无效的歌单 ID");

  const { data } = useSuspenseQuery({
    queryKey: ["playlist", id],
    queryFn: () => getPlaylistDetail(Number(id)),
  });

  const playlist = data.playlist;
  const visibleCount = useLoadMore(playlist.tracks?.length ?? 0);

  const handlePlay = async (track: SongRef) => {
    try {
      await play(track);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "播放失败");
    }
  };

  const handlePlayAll = async () => {
    const tracks = playlist.tracks;
    if (!tracks?.length) return;
    try {
      await replaceAndPlay(tracks);
    } catch {
      toast.error("没有可播放的歌曲");
    }
  };

  /* 构建统计数据 */
  const stats: StatItemProps[] = [];
  stats.push({
    icon: Play,
    value: formatCount(playlist.playCount),
    label: "次播放",
  });
  stats.push({
    icon: ListMusic,
    value: String(playlist.trackCount),
    label: "首",
  });
  if (playlist.subscribedCount != null && playlist.subscribedCount > 0) {
    stats.push({
      icon: Users,
      value: formatCount(playlist.subscribedCount),
      label: "收藏",
    });
  }
  if (playlist.commentCount != null && playlist.commentCount > 0) {
    stats.push({
      icon: MessageCircle,
      value: formatCount(playlist.commentCount),
      label: "评论",
    });
  }

  /* 构建元信息行 */
  const metaParts: string[] = [];
  if (playlist.creator) metaParts.push(playlist.creator.nickname);
  if (playlist.createTime)
    metaParts.push(`${formatDate(playlist.createTime)}创建`);
  if (playlist.updateTime && playlist.updateTime !== playlist.createTime) {
    metaParts.push(`${formatDate(playlist.updateTime)}更新`);
  }

  return (
    <div className="p-6 space-y-6">
      {/* ═══ Header ═══ */}
      <div className="flex gap-6">
        {/* 封面 */}
        {playlist.coverUrl && (
          <div className="relative h-52 w-52 shrink-0">
            <div
              aria-hidden="true"
              className="absolute rounded-xl"
              style={{
                backgroundImage: `url(${getNcmImageUrl(playlist.coverUrl, 400)})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
                filter: "blur(16px) opacity(0.5)",
                height: "100%",
                width: "100%",
                transform: "scale(0.94) translateY(2%)",
                zIndex: -1,
              }}
            />
            <div className="relative h-52 w-52 rounded-xl overflow-hidden z-[1]">
              <ImageWithFade
                alt={playlist.name}
                className={cn(
                  "h-52 w-52 shrink-0 rounded-xl object-cover",
                  "ring-1 ring-border/20",
                )}
                src={getNcmImageUrl(playlist.coverUrl, 400)}
              />
            </div>
          </div>
        )}

        {/* 元数据 */}
        <div className="flex-1 min-w-0 space-y-3 pt-1">
          {/* 标题 */}
          <h1 className="text-3xl font-bold leading-tight line-clamp-2">
            {playlist.name}
          </h1>

          {/* 创建者 + 时间 */}
          {metaParts.length > 0 && (
            <p className="text-sm text-muted-foreground">
              {metaParts.join(" · ")}
            </p>
          )}

          {/* 标签 */}
          {playlist.tags && playlist.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {playlist.tags.map((tag) => (
                <span
                  className={cn(
                    "px-2 py-0.5 rounded-md text-xs",
                    "bg-accent text-accent-foreground",
                    "ring-1 ring-border/20",
                  )}
                  key={tag}
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* 统计数据 */}
          {stats.length > 0 && (
            <div className="flex flex-wrap gap-x-5 gap-y-1.5">
              {stats.map((stat) => (
                <StatItem key={stat.label} {...stat} />
              ))}
            </div>
          )}

          {/* 操作按钮 */}
          <div className="flex items-center gap-3 pt-0.5">
            <Button onClick={handlePlayAll} size="default">
              <Play className="h-4 w-4" />
              播放全部
            </Button>
            {data.fromCache && (
              <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                缓存数据
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ═══ 简介 ═══ */}
      {playlist.description && (
        <div
          className={cn(
            "rounded-xl bg-card ring-1 ring-border/20 px-5 py-4 space-y-2",
          )}
        >
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            简介
          </p>
          <DescriptionBlock text={playlist.description} />
        </div>
      )}

      {/* ═══ Tab 切换栏 ═══ */}
      <TabBar active={activeTab} onChange={setActiveTab} />

      {/* ═══ Tab 内容 ═══ */}
      {activeTab === "songs" ? (
        /* 歌曲列表 */
        playlist.tracks &&
        playlist.tracks.length > 0 && (
          <div className="space-y-0.5">
            <div className="flex items-center gap-2 px-3 pb-2">
              <ListMusic className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">歌曲</span>
              <span className="text-sm font-medium tabular-nums">
                {playlist.tracks.length}
              </span>
            </div>

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
  );
};

/* ------------------------------------------------------------------ */
/*  导出                                                               */
/* ------------------------------------------------------------------ */

export default function Playlist() {
  return (
    <Suspense fallback={<PlaylistSkeleton />}>
      <PlaylistContent />
    </Suspense>
  );
}
