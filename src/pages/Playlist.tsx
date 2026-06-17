import { useSuspenseQuery } from "@tanstack/react-query";
import { ListMusic, MessageCircle, Play, Users } from "lucide-react";
import { Suspense, useState } from "react";
import { useParams } from "react-router-dom";
import { CommentPanel, CommentSkeleton } from "@/components/comment";
import { TrackRow, TrackRowSkeleton } from "@/components/track";
import { Button } from "@/components/ui/button";
import { Cover } from "@/components/ui/cover";
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
}

const TabBar = ({ active, onChange }: TabBarProps) => (
  <div className="flex border-b border-border/40">
    {TABS.map((tab) => (
      <button
        className={cn(
          "relative px-5 py-3 text-sm font-medium transition-colors",
          active === tab.key
            ? "text-foreground"
            : "text-muted-foreground hover:text-foreground/80",
        )}
        key={tab.key}
        onClick={() => onChange(tab.key)}
        type="button"
      >
        {tab.label}
        {active === tab.key && (
          <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-5 h-0.5 bg-primary rounded-full" />
        )}
      </button>
    ))}
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
        <Skeleton className="h-4 w-44 rounded" shimmer />
        <div className="flex gap-1.5">
          <Skeleton className="h-5 w-12 rounded-md" shimmer />
          <Skeleton className="h-5 w-14 rounded-md" shimmer />
          <Skeleton className="h-5 w-10 rounded-md" shimmer />
        </div>
        <div className="flex gap-5">
          <Skeleton className="h-4 w-14 rounded" shimmer />
          <Skeleton className="h-4 w-12 rounded" shimmer />
        </div>
        <div className="pt-1">
          <Skeleton className="h-9 w-28 rounded-md" shimmer />
        </div>
      </div>
    </div>

    {/* Description */}
    <div className="border-l-2 border-primary/20 pl-5 py-0.5 space-y-2">
      <p className="text-xs font-medium text-muted-foreground/60 uppercase tracking-widest">
        简介
      </p>
      <Skeleton className="h-4 w-full rounded" shimmer />
      <Skeleton className="h-4 w-3/4 rounded" shimmer />
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
        // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton array
        <TrackRowSkeleton index={i} key={i} />
      ))}
    </div>
  </div>
);

/* ------------------------------------------------------------------ */
/*  描述区域                                                            */
/* ------------------------------------------------------------------ */

const DESCRIPTION_PREVIEW = 120;

const DescriptionBlock = ({ text }: { text: string }) => {
  const [expanded, setExpanded] = useState(false);
  const needsToggle = text.length > DESCRIPTION_PREVIEW;

  return (
    <div className="space-y-1.5">
      <p className="text-sm text-muted-foreground leading-relaxed">
        {expanded || !needsToggle
          ? text
          : `${text.slice(0, DESCRIPTION_PREVIEW)}…`}
      </p>
      {needsToggle && (
        <button
          className="inline-flex items-center gap-1 text-xs text-primary/80 hover:text-primary transition-colors"
          onClick={() => setExpanded((v) => !v)}
          type="button"
        >
          {expanded ? "收起" : "展开全文"}
        </button>
      )}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  页面主体                                                            */
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
  const stats: { icon: typeof Play; value: string; label: string }[] = [];
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
    <div className="py-8 pl-8 pr-4 space-y-8">
      {/* ═══ Header ═══ */}
      <div className="flex gap-8 items-center">
        {/* 封面 */}
        {playlist.coverUrl && (
          <Cover
            alt={playlist.name}
            className="h-56 w-56 shrink-0"
            foregroundClassName="rounded-2xl shadow-lg shadow-black/10 dark:shadow-black/30"
            src={getNcmImageUrl(playlist.coverUrl, 400)}
          />
        )}

        {/* 元数据 */}
        <div className="flex-1 min-w-0 space-y-4">
          {/* 标题 */}
          <h1 className="text-3xl font-bold tracking-tight leading-tight line-clamp-2">
            {playlist.name}
          </h1>

          {/* 创建者 + 时间 */}
          {metaParts.length > 0 && (
            <p className="text-sm text-muted-foreground/80">
              {metaParts.join("  ·  ")}
            </p>
          )}

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

          {/* 统计数据 */}
          {stats.length > 0 && (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(7rem,auto))] gap-x-5 gap-y-1 text-sm">
              {stats.map((stat) => (
                <span className="flex items-center gap-1.5" key={stat.label}>
                  <stat.icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="font-medium tabular-nums">{stat.value}</span>
                  <span className="text-muted-foreground">{stat.label}</span>
                </span>
              ))}
            </div>
          )}

          {/* 操作按钮 */}
          <div className="flex items-center gap-3 pt-1">
            <Button onClick={handlePlayAll} size="default">
              <Play className="h-4 w-4" />
              播放全部
            </Button>
            {data.fromCache && (
              <span className="text-xs text-muted-foreground/70 bg-muted px-2 py-0.5 rounded">
                缓存数据
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ═══ 简介 ═══ */}
      {playlist.description && (
        <div className="border-l-2 border-primary/20 pl-5 py-0.5 space-y-2">
          <p className="text-xs font-medium text-muted-foreground/60 uppercase tracking-widest">
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
            <div className="flex items-center gap-3 px-3 pb-3 border-b border-border/30 mb-2">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                歌曲列表
              </span>
              <span className="text-xs tabular-nums text-muted-foreground/60">
                {playlist.tracks.length} 首
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
