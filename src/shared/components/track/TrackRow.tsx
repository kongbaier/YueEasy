import { Disc3, Heart, ListPlus, Play, SkipForward } from 'lucide-react';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/shared/ui/context-menu';
import { Skeleton } from '@/shared/ui/skeleton';
import { DecodedImage } from '@/shared/ui/image';
import type { Song } from '@/shared/types/uiModels';
import { cn } from '@/shared/utils/cn';
import { formatDuration } from '@/shared/utils/format';
import { getNcmImageUrl } from '@/shared/utils/image';
import { useLikeAction } from '@/features/like/hooks/useLikeAction';
import { LikeButton } from '@/features/like/components/LikeButton';
import { useTrackActions } from '@/features/player/hooks/useTrackActions';

/* ------------------------------------------------------------------ */
/*  行布局常量                                                         */
/*  TrackRow 与 TrackRowSkeleton 必须逐列对齐（序号 / 封面 / 标题歌手   */
/*  / 专辑 / 红心 / 时长）：列宽与间距只在这里改，两侧共用同一组常量，   */
/*  否则加载态与真实行会横向错位。                                      */
/* ------------------------------------------------------------------ */

const ROW_BASE = 'flex w-full items-center gap-3 rounded-md px-3 py-2';
/** 序号列 */
const ROW_INDEX =
  'w-6 shrink-0 text-center text-xs text-muted-foreground tabular-nums';
/** 封面 */
const ROW_COVER = 'h-9 w-9 shrink-0 rounded';
/** 红心列（LikeButton size="icon-sm" → size-7） */
const ROW_LIKE = 'size-7 shrink-0';
/** 时长列 */
const ROW_DURATION =
  'w-10 shrink-0 text-right text-xs text-muted-foreground tabular-nums';

interface TrackRowProps {
  track: Song;
  index: number;
  onPlay: (track: Song) => void;
  /** 可选来源标签（如「本地」），渲染在歌名旁。 */
  badge?: string;
  /** 可选标记（如「原唱」），渲染在歌手名后。语义由调用方解读，此处只负责呈现。 */
  artistTag?: string;
}

export const TrackRow = ({
  track,
  index,
  onPlay,
  badge,
  artistTag,
}: TrackRowProps) => {
  const { like, isLiked } = useLikeAction();
  const liked = isLiked(track.id);

  const { handlePlayNext, handleAddToQueue } = useTrackActions();
  const handleLike = () => like(track);
  return (
    <ContextMenu>
      <ContextMenuTrigger
        className={cn(
          ROW_BASE,
          'cursor-pointer text-left text-sm transition-colors hover:bg-accent content-visibility-auto',
        )}
        onDoubleClick={() => onPlay(track)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onPlay(track);
        }}
        role="button"
        style={{ containIntrinsicSize: 'auto 52px' }}
        tabIndex={0}
      >
        <span className={ROW_INDEX}>{String(index + 1).padStart(2, '0')}</span>
        {track.album.picUrl && (
          <DecodedImage
            alt={track.album.name}
            className="size-full object-cover"
            containerClassName={ROW_COVER}
            src={getNcmImageUrl(track.album.picUrl, 50)}
          />
        )}
        <div className="flex-1 min-w-0">
          <p className="flex items-center gap-1 min-w-0">
            <span className="truncate">{track.name}</span>
            {track.fee === 1 && (
              <Disc3 className="h-3.5 w-3.5 shrink-0 text-amber-400" />
            )}
            {badge && (
              <span className="shrink-0 rounded-sm bg-muted px-1 py-0.5 text-[10px] leading-none text-muted-foreground">
                {badge}
              </span>
            )}
          </p>
          {/* 歌手名截断、标记恒显，所以截断加在内层 span 上而非 <p> */}
          <p className="flex items-center gap-1 min-w-0 text-xs text-muted-foreground">
            <span className="truncate">
              {track.artists.map((a) => a.name).join('/') || '未知歌手'}
            </span>
            {artistTag && (
              <span className="shrink-0 rounded-sm border border-primary/35 bg-primary/10 p-0.5 text-[10px] leading-none font-medium text-primary">
                {artistTag}
              </span>
            )}
          </p>
        </div>
        <span className="flex-1 min-w-0 truncate text-xs text-muted-foreground">
          {track.album.name || '-'}
        </span>
        <span className={ROW_LIKE} onClick={(e) => e.stopPropagation()}>
          <LikeButton track={track} size="icon-sm" />
        </span>
        <span className={ROW_DURATION}>
          {formatDuration(track.durationMs / 1000)}
        </span>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={() => onPlay(track)}>
          <Play className="h-4 w-4" />
          播放
        </ContextMenuItem>
        <ContextMenuItem onClick={() => handlePlayNext(track)}>
          <SkipForward className="h-4 w-4" />
          下一首播放
        </ContextMenuItem>
        <ContextMenuItem onClick={() => handleAddToQueue(track)}>
          <ListPlus className="h-4 w-4" />
          添加到播放列表
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={handleLike}>
          <Heart className="h-4 w-4" fill={liked ? '#ef4444' : 'none'} />
          {liked ? '不再喜欢' : '喜欢'}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
};

/**
 * TrackRow 的加载态：布局常量与 TrackRow 共用，保证加载完成时整行不跳动。
 * 与 TrackRow 同文件定义——两者是同一组件的两种状态，改列宽必须同步。
 */
export const TrackRowSkeleton = ({ index }: { index: number }) => (
  <div className={ROW_BASE}>
    <span className={ROW_INDEX}>{String(index + 1).padStart(2, '0')}</span>
    <Skeleton className={ROW_COVER} shimmer />
    <div className="flex-1 min-w-0 space-y-1.5">
      <Skeleton className="h-4 w-full max-w-48 rounded" shimmer />
      <Skeleton className="h-3 w-24 rounded" shimmer />
    </div>
    <Skeleton className="h-3 w-24 flex-1 min-w-0 rounded" shimmer />
    <Skeleton className={ROW_LIKE} shimmer />
    <Skeleton className={ROW_DURATION} shimmer />
  </div>
);

/**
 * 整列歌曲占位（默认 8 行）。属于「组合占位」，各页面共用以免重复拼装；
 * 页面自己的版式骨架仍由页面定义（如 AlbumSkeleton / PlaylistSkeleton）。
 */
export const TrackRowSkeletonList = ({ count = 8 }: { count?: number }) => (
  <div className="space-y-0.5">
    {Array.from({ length: count }).map((_, i) => (
      // oxlint-disable-next-line react/no-array-index-key
      <TrackRowSkeleton index={i} key={i} />
    ))}
  </div>
);
