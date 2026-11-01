import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Mic, Music, Play } from 'lucide-react';
import { usePageTitle } from '@/app/layout/PageTitleContext';
import { TrackRow, TrackRowSkeletonList } from '@/shared/components/track';
import { AlbumCard, AlbumCardSkeleton } from '@/shared/components/album-card';
import { Button } from '@/shared/ui/button';
import { Cover } from '@/shared/ui/image';
import { Skeleton } from '@/shared/ui/skeleton';
import { ScrollArea } from '@/shared/ui/scroll-area';
import { ExpandableText } from '@/shared/ui/expandable-text';
import { TabBar, type TabBarItem } from '@/shared/ui/tab-bar';
import { useScrollMemory } from '@/shared/hooks/useScrollMemory';
import { formatCount } from '@/shared/utils/format';
import { getNcmImageUrl } from '@/shared/utils/image';
import { useArtistViewModel } from './hooks/useArtistViewModel';
import { useArtistAlbumsViewModel } from './hooks/useArtistAlbumsViewModel';

type TabKey = 'songs' | 'albums';

/* ------------------------------------------------------------------ */
/*  骨架屏                                                             */
/* ------------------------------------------------------------------ */

const ArtistSkeleton = () => (
  <ScrollArea className="h-full py-8 pl-8 pr-4">
    <div className="space-y-8">
      <div className="flex gap-8 items-center">
        <Skeleton className="size-48 shrink-0 rounded-full" shimmer />
        <div className="flex-1 min-w-0 space-y-4">
          <Skeleton className="h-9 w-64 rounded" shimmer />
          <Skeleton className="h-4 w-44 rounded" shimmer />
          <Skeleton className="h-4 w-32 rounded" shimmer />
          <div className="pt-1">
            <Skeleton className="h-9 w-28 rounded-md" shimmer />
          </div>
        </div>
      </div>
      <div className="space-y-4">
        <Skeleton className="h-9 w-40 rounded" shimmer />
        <TrackRowSkeletonList />
      </div>
    </div>
  </ScrollArea>
);

/* ------------------------------------------------------------------ */
/*  页面主体                                                           */
/* ------------------------------------------------------------------ */

/**
 * 歌手主页：与专辑 / 歌单详情页同构（头部信息 + 分类条 + 内容区）。
 *
 * - 头部：圆形头像、艺名与别名、单曲 / 专辑统计、歌手简介、播放全部
 * - 「热门歌曲」来自 `/api/v1/artist/{id}` 的 `hotSongs`；「专辑」单独分页取数，
 *   只在切到该分类时才请求（`useArtistAlbumsViewModel` 的 `enabled`）
 * - 所有 hook 在 early return 之前调用（KeepAlive 下登录态 / 路由参数变化不改 hook 数量）
 */
export default function ArtistPage() {
  const { id } = useParams<{ id: string }>();
  const resolvedId = Number(id);
  const [activeTab, setActiveTab] = useState<TabKey>('songs');
  const [albumLimit, setAlbumLimit] = useState(30);
  const scrollRef = useScrollMemory();

  if (!resolvedId) throw new Error('无效的歌手 ID');

  const { artist, hotSongs, moreSongs, handlePlay, handlePlayAll, isPending } =
    useArtistViewModel(resolvedId);
  const {
    albums,
    more: moreAlbums,
    isLoading: albumsLoading,
    isLoadingMore: albumsLoadingMore,
  } = useArtistAlbumsViewModel(resolvedId, activeTab === 'albums', albumLimit);

  usePageTitle(artist?.name);

  if (isPending) return <ArtistSkeleton />;

  if (!artist) return null;

  const aliases = (artist.alias ?? []).filter((a) => a && a !== artist.name);

  const tabs: TabBarItem<TabKey>[] = [
    {
      key: 'songs',
      label: '热门歌曲',
      badge: hotSongs.length > 0 ? formatCount(hotSongs.length) : undefined,
    },
    {
      key: 'albums',
      label: '专辑',
      badge:
        artist.albumSize != null && artist.albumSize > 0
          ? formatCount(artist.albumSize)
          : undefined,
    },
  ];

  return (
    <ScrollArea className="h-full py-8 pl-8 pr-4" ref={scrollRef}>
      <div className="space-y-8">
        {/* ═══ Header ═══ */}
        <header className="flex gap-8 items-center">
          {artist.picUrl ? (
            <Cover
              alt={artist.name}
              className="size-48 shrink-0"
              foregroundClassName="rounded-full shadow-lg shadow-black/10 dark:shadow-black/30"
              src={getNcmImageUrl(artist.picUrl, 400)}
            />
          ) : (
            <span className="size-48 shrink-0 rounded-full bg-muted flex items-center justify-center">
              <Mic className="size-12 text-muted-foreground" />
            </span>
          )}

          <div className="flex-1 min-w-0 flex flex-col justify-between">
            <div className="space-y-3">
              <h1 className="text-2xl font-bold tracking-tight truncate">
                {artist.name}
              </h1>

              {aliases.length > 0 && (
                <p className="truncate text-sm text-muted-foreground">
                  {aliases.join(' / ')}
                </p>
              )}

              <div className="flex items-center gap-5 text-sm">
                <span className="flex items-center gap-1.5">
                  <Music className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="font-medium tabular-nums">
                    {artist.musicSize ?? hotSongs.length}
                  </span>
                  <span className="text-muted-foreground">首单曲</span>
                </span>
                {artist.albumSize != null && artist.albumSize > 0 && (
                  <span className="flex items-center gap-1.5">
                    <span className="font-medium tabular-nums">
                      {artist.albumSize}
                    </span>
                    <span className="text-muted-foreground">张专辑</span>
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3 pt-1">
              <Button onClick={handlePlayAll} size="default">
                <Play className="h-4 w-4" />
                播放全部
              </Button>
            </div>
          </div>
        </header>

        {/* ═══ 简介 ═══ */}
        {artist.briefDesc && (
          <div className="border-l-2 border-primary/20 pl-5 py-0.5 space-y-2">
            <p className="text-xs font-medium text-muted-foreground/60 uppercase tracking-widest">
              歌手简介
            </p>
            <ExpandableText text={artist.briefDesc} />
          </div>
        )}

        {/* ═══ 内容 ═══ */}
        <div className="space-y-4">
          <TabBar active={activeTab} items={tabs} onChange={setActiveTab} />

          {activeTab === 'songs' ? (
            hotSongs.length > 0 ? (
              <div className="space-y-0.5">
                {hotSongs.map((track, index) => (
                  <TrackRow
                    index={index}
                    key={track.id}
                    onPlay={handlePlay}
                    track={track}
                  />
                ))}
                {moreSongs && (
                  <p className="pt-3 text-center text-xs text-muted-foreground/60">
                    仅展示热门歌曲，更多作品可搜索歌手名
                  </p>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 gap-2">
                <Music className="size-8 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">暂无热门歌曲</p>
              </div>
            )
          ) : albumsLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
              {Array.from({ length: 12 }).map((_, i) => (
                // oxlint-disable-next-line react/no-array-index-key
                <AlbumCardSkeleton key={i} />
              ))}
            </div>
          ) : albums.length > 0 ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                {albums.map((album) => (
                  <AlbumCard album={album} key={album.id} />
                ))}
              </div>
              {moreAlbums && (
                <div className="flex justify-center">
                  <Button
                    disabled={albumsLoadingMore}
                    onClick={() => setAlbumLimit((n) => n + 30)}
                    variant="outline"
                  >
                    {albumsLoadingMore ? '加载中…' : '加载更多'}
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 gap-2">
              <Mic className="size-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">暂无专辑</p>
            </div>
          )}
        </div>
      </div>
    </ScrollArea>
  );
}
