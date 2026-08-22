import { Disc, Music, Play } from "lucide-react";
import { Suspense } from "react";
import { useParams } from "react-router-dom";
import { Cover } from "@/shared/ui/image";
import { ExpandableText } from "@/shared/ui/expandable-text";
import { usePageTitle } from "@/app/layout/PageTitleContext";
import { TrackRow, TrackRowSkeleton } from "@/shared/components/track";
import { Button } from "@/shared/ui/button";
import { Skeleton } from "@/shared/ui/skeleton";
import { getNcmImageUrl } from "@/shared/utils/image";
import { useAlbumViewModel } from "./useAlbumViewModel";

/* ------------------------------------------------------------------ */
/*  工具                                                               */
/* ------------------------------------------------------------------ */

const formatDate = (ts: number) => {
  const d = new Date(ts);
  return `${d.getFullYear()}年${d.getMonth() + 1}月`;
};

/* ------------------------------------------------------------------ */
/*  骨架屏                                                             */
/* ------------------------------------------------------------------ */

const AlbumSkeleton = () => (
  <div className="py-8 pl-8 pr-4 space-y-8">
    <div className="flex gap-8 items-center">
      <Skeleton className="h-56 w-56 shrink-0 rounded-2xl" shimmer />
      <div className="flex-1 min-w-0 space-y-4">
        <Skeleton className="h-9 w-64 rounded" shimmer />
        <Skeleton className="h-4 w-44 rounded" shimmer />
        <Skeleton className="h-4 w-28 rounded" shimmer />
        <div className="pt-1">
          <Skeleton className="h-9 w-28 rounded-md" shimmer />
        </div>
      </div>
    </div>
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

const AlbumContent = () => {
  const { id } = useParams<{ id: string }>();

  if (!id) throw new Error("无效的专辑 ID");

  const { album, tracks, visibleCount, handlePlay, handlePlayAll } =
    useAlbumViewModel(Number(id));
  usePageTitle(album.name);

  const metaParts: string[] = [];
  if (album.artist?.name) metaParts.push(album.artist.name);
  if (album.publishTimeMs)
    metaParts.push(`${formatDate(album.publishTimeMs)}发行`);
  if (album.company) metaParts.push(album.company);

  return (
    <div className="py-8 pl-8 pr-4 space-y-8">
      {/* ═══ Header ═══ */}
      <div className="flex gap-8 items-center">
        {album.picUrl ? (
          <Cover
            alt={album.name}
            className="h-56 w-56 shrink-0"
            foregroundClassName="rounded-2xl shadow-lg shadow-black/10 dark:shadow-black/30"
            src={getNcmImageUrl(album.picUrl, 400)}
          />
        ) : (
          <span className="h-56 w-56 shrink-0 bg-muted rounded-2xl flex items-center justify-center">
            <Disc className="size-12 text-muted-foreground" />
          </span>
        )}

        <div className="flex-1 min-w-0 space-y-4">
          <h1 className="text-2xl font-bold tracking-tight">{album.name}</h1>

          {metaParts.length > 0 && (
            <p className="text-sm text-muted-foreground/80">
              {metaParts.join("  ·  ")}
            </p>
          )}

          {/* Stats */}
          <div className="flex items-center gap-5 text-sm">
            <span className="flex items-center gap-1.5">
              <Music className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="font-medium tabular-nums">{album.size}</span>
              <span className="text-muted-foreground">首</span>
            </span>
          </div>

          {/* Play all */}
          <div className="flex items-center gap-3 pt-1">
            <Button onClick={handlePlayAll} size="default">
              <Play className="h-4 w-4" />
              播放全部
            </Button>
          </div>
        </div>
      </div>

      {/* ═══ 简介 ═══ */}
      {album.description && (
        <div className="border-l-2 border-primary/20 pl-5 py-0.5 space-y-2">
          <p className="text-xs font-medium text-muted-foreground/60 uppercase tracking-widest">
            专辑介绍
          </p>
          <ExpandableText text={album.description} />
        </div>
      )}

      {/* ═══ Track list ═══ */}
      {tracks.length > 0 && (
        <div className="space-y-0.5">
          <div className="flex items-center gap-3 px-3 pb-3 border-b border-border/30 mb-2">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              歌曲列表
            </span>
            <span className="text-xs tabular-nums text-muted-foreground/60">
              {tracks.length} 首
            </span>
          </div>
          {tracks.slice(0, visibleCount).map((track, index) => (
            <TrackRow
              index={index}
              key={track.id}
              onPlay={handlePlay}
              track={track}
            />
          ))}
        </div>
      )}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  导出                                                               */
/* ------------------------------------------------------------------ */

export default function Album() {
  return (
    <Suspense fallback={<AlbumSkeleton />}>
      <AlbumContent />
    </Suspense>
  );
}
