import type { Playlist } from '@/shared/types/entities';
import { Button } from '@/shared/ui/button';
import { Cover } from '@/shared/ui/image';
import { Skeleton } from '@/shared/ui/skeleton';
import { formatCount, formatDate } from '@/shared/utils/format';
import { getNcmImageUrl } from '@/shared/utils/image';
import { Play } from 'lucide-react';

interface PlaylistInfoProps {
  playlist: Playlist;
  fromCache: boolean;
  onPlayAll: () => void;
}

export const PlaylistInfo = ({
  playlist,
  fromCache,
  onPlayAll,
}: PlaylistInfoProps) => {
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
    <header className="flex gap-8">
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
              {metaParts.join('  ·  ')}
            </p>
          )}
        </div>

        {/* 操作按钮 */}
        <div className="flex items-center gap-3 pt-1">
          <Button
            className="h-auto py-2 rounded-lg"
            onClick={onPlayAll}
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
    </header>
  );
};

PlaylistInfo.Skeleton = () => (
  <header className="flex gap-8">
    {/* 封面 */}
    <Skeleton className="size-48 shrink-0 rounded-2xl" shimmer />

    {/* 元数据 */}
    <div className="flex-1 min-w-0 flex flex-col justify-between">
      <div className="space-y-3">
        <Skeleton className="h-8 w-64 rounded" shimmer />
        <div className="flex flex-wrap gap-1.5">
          <Skeleton className="h-5 w-12 rounded-md" shimmer />
          <Skeleton className="h-5 w-14 rounded-md" shimmer />
          <Skeleton className="h-5 w-10 rounded-md" shimmer />
        </div>
        <Skeleton className="h-4 w-44 rounded" shimmer />
        <div className="flex gap-5">
          <Skeleton className="h-4 w-14 rounded" shimmer />
          <Skeleton className="h-4 w-12 rounded" shimmer />
        </div>
      </div>

      {/* 操作按钮 */}
      <div className="flex items-center gap-3 pt-1">
        <Skeleton className="h-9 w-28 rounded-md" shimmer />
      </div>
    </div>
  </header>
);
