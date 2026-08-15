import { Disc } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Skeleton } from '@/shared/ui/skeleton';
import { SmartImage } from '@/shared/ui/image';
import { getNcmImageUrl } from '@/shared/utils/image';
import type { Album } from '@/shared/types/entities';

interface SearchAlbumCardProps {
  /** 专辑搜索结果项 */
  item: Album;
}

export function SearchAlbumCard({ item }: SearchAlbumCardProps) {
  const navigate = useNavigate();

  return (
    <div
      className="group cursor-pointer rounded-lg p-2 transition-colors hover:bg-accent"
      onClick={() => navigate(`/album/${item.id}`)}
    >
      <div className="relative aspect-square overflow-hidden rounded-md mb-2">
        {item.picUrl ? (
          <SmartImage
            alt={item.name}
            className="h-full w-full object-cover"
            containerClassName="h-full w-full"
            src={getNcmImageUrl(item.picUrl, 200)}
          />
        ) : (
          <span className="h-full w-full bg-muted flex items-center justify-center">
            <Disc className="size-8 text-muted-foreground" />
          </span>
        )}
      </div>
      <p className="truncate text-sm font-medium">{item.name}</p>
      <p className="truncate text-xs text-muted-foreground">
        {item.artist?.name ?? '未知歌手'}
      </p>
    </div>
  );
}

export function SearchAlbumCardSkeleton() {
  return (
    <div className="rounded-lg p-2">
      <Skeleton className="aspect-square w-full rounded-md" shimmer />
      <Skeleton className="h-4 w-3/4 mt-2 rounded" shimmer />
      <Skeleton className="h-3 w-1/2 mt-1 rounded" shimmer />
    </div>
  );
}
