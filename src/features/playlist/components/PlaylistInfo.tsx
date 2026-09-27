import type { Playlist } from '@/shared/types/uiModels';
import { Button } from '@/shared/ui/button';
import { Cover } from '@/shared/ui/image';
import { Skeleton } from '@/shared/ui/skeleton';
import { formatCount, formatDate } from '@/shared/utils/format';
import { getNcmImageUrl } from '@/shared/utils/image';
import { cn } from '@/shared/utils/cn';
import { Play, Star } from 'lucide-react';
import { MetaLine, type MetaItem } from './MetaLine';
import { usePlaylistSubscription } from '../hooks/usePlaylistSubscription';

interface PlaylistInfoProps {
  playlist: Playlist;
  onPlayAll: () => void;
}

/** 元信息行的字段裁剪逻辑（只决定展示什么，不决定样式） */
const playlistMeta = (playlist: Playlist): (MetaItem | false | undefined)[] => {
  const {
    playCount,
    subscribedCount = 0,
    creator,
    createTimeMs,
    updateTimeMs,
  } = playlist;

  return [
    {
      key: 'play',
      node: formatCount(playCount),
      ext: '次播放',
    },
    subscribedCount > 0 && {
      key: 'subscribe',
      node: formatCount(subscribedCount),
      ext: '收藏',
    },
    creator && { key: 'creator', node: creator.nickname },
    createTimeMs != null && {
      key: 'createTime',
      node: formatDate(createTimeMs),
      ext: '创建',
    },
    updateTimeMs != null &&
      updateTimeMs !== createTimeMs && {
        key: 'updateTime',
        node: formatDate(updateTimeMs),
        ext: '更新',
      },
  ];
};

export const PlaylistInfo = ({
  playlist,
  onPlayAll,
}: PlaylistInfoProps) => {
  const { isOwn, isPending, subscribed, toggle } =
    usePlaylistSubscription(playlist);

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

          <MetaLine items={playlistMeta(playlist)} />
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
          {!isOwn && (
            <Button
              className="h-auto py-2 rounded-lg"
              disabled={isPending}
              onClick={toggle}
              size="default"
              title={subscribed ? '取消收藏' : '收藏'}
              variant="outline"
            >
              <Star
                className={cn(
                  'size-3.5',
                  subscribed && 'fill-primary text-primary',
                )}
              />
              <span>{subscribed ? '取消收藏' : '收藏歌单'}</span>
            </Button>
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
        <Skeleton className="h-9 w-24 rounded-md" shimmer />
      </div>
    </div>
  </header>
);
