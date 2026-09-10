import { Crown, Heart, ListPlus, Play, SkipForward } from 'lucide-react';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/shared/ui/context-menu';
import { Skeleton } from '@/shared/ui/skeleton';
import { DecodedImage } from '@/shared/ui/image';
import type { Song } from '@/shared/types/entities';
import { formatDuration } from '@/shared/utils/format';
import { getNcmImageUrl } from '@/shared/utils/image';
import { useLikeAction } from '@/modules/like/hooks/useLikeAction';
import { LikeButton } from '@/modules/like/components/LikeButton';
import { useTrackActions } from '@/modules/player/hooks/useTrackActions';

interface TrackRowProps {
  track: Song;
  index: number;
  onPlay: (track: Song) => void;
  /** 可选来源标签（如「本地」），渲染在歌名旁。 */
  badge?: string;
}

export const TrackRow = ({ track, index, onPlay, badge }: TrackRowProps) => {
  const { handleLike, isLiked } = useLikeAction();
  const liked = isLiked(track.id);

  const { handlePlayNext, handleAddToQueue } = useTrackActions();

  return (
    <ContextMenu>
      <ContextMenuTrigger
        className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors hover:bg-accent w-full text-left content-visibility-auto"
        onDoubleClick={() => onPlay(track)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onPlay(track);
        }}
        role="button"
        style={{ containIntrinsicSize: 'auto 52px' }}
        tabIndex={0}
      >
        <span className="w-6  text-center text-xs text-muted-foreground">
          {String(index + 1).padStart(2, '0')}
        </span>
        {track.album.picUrl && (
          <DecodedImage
            alt={track.album.name}
            className="size-full object-cover"
            containerClassName="h-9 w-9 shrink-0 rounded"
            src={getNcmImageUrl(track.album.picUrl, 50)}
          />
        )}
        <div className="flex-1 min-w-0">
          <p className="flex items-center gap-1 min-w-0 font-medium">
            <span className="truncate">{track.name}</span>
            {track.fee === 1 && (
              <Crown className="h-3.5 w-3.5 shrink-0 text-amber-400" />
            )}
            {badge && (
              <span className="shrink-0 rounded-sm bg-muted px-1 py-0.5 text-[10px] leading-none text-muted-foreground">
                {badge}
              </span>
            )}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {track.artists.map((a) => a.name).join('/') || '未知歌手'}
          </p>
        </div>
        <span className="flex-1 min-w-0 truncate text-xs text-muted-foreground">
          {track.album.name || '-'}
        </span>
        <span className="shrink-0" onClick={(e) => e.stopPropagation()}>
          <LikeButton track={track} size="icon-sm" />
        </span>
        <span className="w-10 shrink-0 text-right text-xs text-muted-foreground tabular-nums">
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
        <ContextMenuItem onClick={() => handleLike(track)}>
          <Heart className="h-4 w-4" fill={liked ? '#ef4444' : 'none'} />
          {liked ? '取消收藏' : '收藏'}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
};

export const TrackRowSkeleton = ({ index }: { index: number }) => {
  return (
    <div className="flex items-center gap-3 rounded-lg px-3 py-2">
      <span className="w-8 text-center text-xs text-muted-foreground">
        {String(index + 1).padStart(2, '0')}
      </span>
      <Skeleton className="h-9 w-9 shrink-0 rounded" shimmer />
      <div className="flex-1 min-w-0 space-y-1.5">
        <Skeleton className="h-4 w-full max-w-48 rounded" shimmer />
        <Skeleton className="h-3 w-24 rounded" shimmer />
      </div>
      <Skeleton className="h-3 w-24 rounded flex-1 min-w-0" shimmer />
      <Skeleton className="h-4 w-4 shrink-0 rounded" shimmer />
      <Skeleton className="h-3 w-10 shrink-0 rounded" shimmer />
    </div>
  );
};
