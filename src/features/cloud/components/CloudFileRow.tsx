import { Fragment } from 'react';
import { Disc3, Heart, ListPlus, Music, Play, SkipForward } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/shared/ui/context-menu';
import { DecodedImage } from '@/shared/ui/image';
import { Skeleton } from '@/shared/ui/skeleton';
import { cn } from '@/shared/utils/cn';
import { formatBytes, formatYmd } from '@/shared/utils/format';
import { getNcmImageUrl } from '@/shared/utils/image';
import { ArtistLink } from '@/features/artist/components/ArtistLink';
import { LikeButton } from '@/features/like/components/LikeButton';
import { useLikeAction } from '@/features/like/hooks/useLikeAction';
import { useTrackActions } from '@/features/player/hooks/useTrackActions';
import type { CloudTrack } from '../constants';

/* ------------------------------------------------------------------ */
/*  列布局常量                                                         */
/*  「表头」与「数据行」必须逐列对齐（# / 封面 / 标题(含歌手) / 专辑  */
/*  / 格式 / 上传时间 / 大小 / 红心）：列宽只在这里改，两处共用同一组   */
/*  常量。                                                             */
/* ------------------------------------------------------------------ */

const ROW_BASE = 'flex w-full items-center gap-3 rounded-md px-3 py-2';
/** 序号列 */
const ROW_INDEX =
  'w-6 shrink-0 text-center text-xs text-muted-foreground tabular-nums';
/** 封面（与 TrackRow 同尺寸） */
const ROW_COVER = 'size-9 shrink-0 rounded';
/** 标题列：占剩余宽度，歌名 + 歌手两行 */
const COL_TITLE = 'flex-1 min-w-0';
/** 专辑列 */
const COL_ALBUM =
  'w-40 shrink-0 truncate text-xs text-muted-foreground hidden md:block';
/** 格式列（mp3 / flac） */
const COL_FORMAT =
  'w-12 shrink-0 text-xs uppercase text-muted-foreground hidden sm:block';
/** 上传时间列 */
const COL_TIME =
  'w-24 shrink-0 text-xs text-muted-foreground tabular-nums hidden sm:block';
/** 大小列 */
const COL_SIZE =
  'w-20 shrink-0 text-right text-xs text-muted-foreground tabular-nums';
/** 红心列（LikeButton size="icon-sm" → size-7） */
const ROW_LIKE = 'size-7 shrink-0';

/**
 * 云盘列表表头：`# / 封面 / 标题(含歌手) / 专辑 / 格式 / 上传时间 ↓ / 大小`。
 *
 * 上传时间列带 ↓ 是因为列表按上传时间倒序（排序在 `useCloudViewModel` 里做，
 * 后端 `cloud/get` 也默认倒序，这里只是把已有的次序标出来）。
 * 封面列在表头里是空占位，只为了与数据行逐列对齐。
 */
export const CloudFileRowHeader = () => (
  <div
    className={cn(
      ROW_BASE,
      'py-1.5 border-b border-border/60 text-xs font-medium text-muted-foreground/70',
    )}
  >
    <span className={ROW_INDEX}>#</span>
    <span className={ROW_COVER} />
    <span className={COL_TITLE}>标题</span>
    <span className={COL_ALBUM}>专辑</span>
    <span className={COL_FORMAT}>格式</span>
    <span className={COL_TIME}>上传时间 ↓</span>
    <span className={COL_SIZE}>大小</span>
    <span className={ROW_LIKE} />
  </div>
);

interface CloudFileRowProps {
  track: CloudTrack;
  index: number;
  onPlay: (track: CloudTrack['song']) => void;
}

/**
 * 云盘文件行：比 `TrackRow` 多「格式 / 上传时间 / 大小」三列，
 * 因此不塞进共享 `TrackRow`（那是「歌曲行」的通用形状），
 * 而在本功能内按表格式布局自建，交互（双击播放 / 右键菜单 / 红心）保持一致。
 */
export const CloudFileRow = ({ track, index, onPlay }: CloudFileRowProps) => {
  const { like, isLiked } = useLikeAction();
  const liked = isLiked(track.song.id);
  const { handlePlayNext, handleAddToQueue } = useTrackActions();
  const handleLike = () => like(track.song);

  return (
    <ContextMenu>
      <ContextMenuTrigger
        className={cn(
          ROW_BASE,
          'cursor-pointer text-left text-sm transition-colors hover:bg-accent content-visibility-auto',
        )}
        onDoubleClick={() => onPlay(track.song)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onPlay(track.song);
        }}
        role="button"
        style={{ containIntrinsicSize: 'auto 52px' }}
        tabIndex={0}
      >
        <span className={ROW_INDEX}>{String(index + 1).padStart(2, '0')}</span>

        {/* ═══ 封面（无封面时给黑底主色音符占位，不让列空着） ═══ */}
        {track.song.album.picUrl ? (
          <DecodedImage
            alt={track.song.album.name || track.song.name}
            className="size-full object-cover"
            containerClassName={ROW_COVER}
            src={getNcmImageUrl(track.song.album.picUrl, 50)}
          />
        ) : (
          <span
            className={cn(
              ROW_COVER,
              'flex items-center justify-center bg-black',
            )}
          >
            <Music className="size-4 text-primary" />
          </span>
        )}

        {/* ═══ 标题 + 歌手 ═══ */}
        <div className={COL_TITLE}>
          <p className="flex items-center gap-1 min-w-0">
            <span className="truncate">{track.song.name}</span>
            {track.song.fee === 1 && (
              <Disc3 className="h-3.5 w-3.5 shrink-0 text-amber-400" />
            )}
          </p>
          {/* 歌手名截断加在内层 span 上，避免整行被长歌手名撑开 */}
          <p className="truncate text-xs text-muted-foreground">
            {track.song.artists.length > 0
              ? track.song.artists.map((artist, i) => (
                  <Fragment key={artist.id > 0 ? artist.id : artist.name}>
                    {i > 0 && <span className="px-0.5">/</span>}
                    {artist.id > 0 ? (
                      <ArtistLink artist={artist} stopPropagation />
                    ) : (
                      // 云盘扁平字段只给名字没有 id（mapper 造 id=0），不进歌手页
                      <span>{artist.name}</span>
                    )}
                  </Fragment>
                ))
              : '未知歌手'}
          </p>
        </div>

        {/* ═══ 专辑（缺失时显式标注，不渲染成空白） ═══ */}
        {!track.song.album.name ? (
          <span className={COL_ALBUM}>未知专辑</span>
        ) : track.song.album.id > 0 ? (
          <Link
            className={cn(COL_ALBUM, 'hover:text-primary hover:underline')}
            onClick={(e) => e.stopPropagation()}
            onDoubleClick={(e) => e.stopPropagation()}
            to={`/album/${track.song.album.id}`}
          >
            {track.song.album.name}
          </Link>
        ) : (
          <span className={COL_ALBUM}>{track.song.album.name}</span>
        )}

        {/* ═══ 格式 / 上传时间 / 大小 ═══ */}
        <span className={COL_FORMAT}>{track.format ?? '-'}</span>
        <span className={COL_TIME}>
          {track.addTimeMs ? formatYmd(track.addTimeMs) : '-'}
        </span>
        <span className={COL_SIZE}>
          {track.fileSizeBytes ? formatBytes(track.fileSizeBytes) : '-'}
        </span>

        <span className={ROW_LIKE} onClick={(e) => e.stopPropagation()}>
          <LikeButton track={track.song} size="icon-sm" />
        </span>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={() => onPlay(track.song)}>
          <Play className="h-4 w-4" />
          播放
        </ContextMenuItem>
        <ContextMenuItem onClick={() => handlePlayNext(track.song)}>
          <SkipForward className="h-4 w-4" />
          下一首播放
        </ContextMenuItem>
        <ContextMenuItem onClick={() => handleAddToQueue(track.song)}>
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

/** 云盘行骨架：列宽与 `CloudFileRow` 共用常量，加载完成时列不跳动。 */
export const CloudFileRowSkeleton = ({ index }: { index: number }) => (
  <div className={ROW_BASE}>
    <span className={ROW_INDEX}>{String(index + 1).padStart(2, '0')}</span>
    <Skeleton className={ROW_COVER} shimmer />
    <div className={cn(COL_TITLE, 'space-y-1.5')}>
      <Skeleton className="h-4 w-full max-w-48 rounded" shimmer />
      <Skeleton className="h-3 w-24 rounded" shimmer />
    </div>
    <Skeleton className={cn(COL_ALBUM, 'h-3 rounded')} shimmer />
    <Skeleton className={cn(COL_FORMAT, 'h-3 rounded')} shimmer />
    <Skeleton className={cn(COL_TIME, 'h-3 rounded')} shimmer />
    <Skeleton className={cn(COL_SIZE, 'h-3 rounded')} shimmer />
    <span className={ROW_LIKE} />
  </div>
);

export const CloudFileRowSkeletonList = ({ count = 8 }: { count?: number }) => (
  <div className="space-y-0.5">
    {Array.from({ length: count }).map((_, i) => (
      // oxlint-disable-next-line react/no-array-index-key
      <CloudFileRowSkeleton index={i} key={i} />
    ))}
  </div>
);
