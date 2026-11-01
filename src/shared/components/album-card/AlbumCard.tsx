import { Disc } from 'lucide-react';
import { Link } from 'react-router-dom';
import { DecodedImage } from '@/shared/ui/image';
import { Skeleton } from '@/shared/ui/skeleton';
import { cn } from '@/shared/utils/cn';
import { getNcmImageUrl } from '@/shared/utils/image';
import type { Album } from '@/shared/types/uiModels';

interface AlbumCardProps {
  album: Album;
  className?: string;
}

/**
 * 专辑卡片（网格用）：封面 + 专辑名 + 歌手名，整卡可点跳 `album/:id`。
 * 搜索结果、歌手主页的专辑栅格共用同一张卡，尺寸由外部栅格决定。
 */
export const AlbumCard = ({ album, className }: AlbumCardProps) => (
  <Link
    className={cn(
      'group block rounded-lg p-2 transition-colors hover:bg-accent',
      className,
    )}
    to={`/album/${album.id}`}
  >
    <div className="relative mb-2 aspect-square overflow-hidden rounded-md">
      {album.picUrl ? (
        <DecodedImage
          alt={album.name}
          className="h-full w-full object-cover"
          containerClassName="h-full w-full"
          src={getNcmImageUrl(album.picUrl, 200)}
        />
      ) : (
        <span className="flex h-full w-full items-center justify-center bg-muted">
          <Disc className="size-8 text-muted-foreground" />
        </span>
      )}
    </div>
    <p className="truncate text-sm font-medium">{album.name}</p>
    <p className="truncate text-xs text-muted-foreground">
      {album.artist?.name ?? '未知歌手'}
    </p>
  </Link>
);

/** 与 AlbumCard 同尺寸的加载态；栅格内逐格对齐，切真实卡片不跳。 */
export const AlbumCardSkeleton = ({ className }: { className?: string }) => (
  <div className={cn('rounded-lg p-2', className)}>
    <Skeleton className="aspect-square w-full rounded-md" shimmer />
    <Skeleton className="mt-2 h-4 w-3/4 rounded" shimmer />
    <Skeleton className="mt-1 h-3 w-1/2 rounded" shimmer />
  </div>
);
