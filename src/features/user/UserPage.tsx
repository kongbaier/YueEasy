import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { User as UserIcon } from 'lucide-react';
import { usePageTitle } from '@/app/layout/PageTitleContext';
import { PlaylistCard } from '@/shared/components/playlist-card';
import { ScrollArea } from '@/shared/ui/scroll-area';
import { Skeleton } from '@/shared/ui/skeleton';
import { DecodedImage } from '@/shared/ui/image';
import { ExpandableText } from '@/shared/ui/expandable-text';
import { TabBar, type TabBarItem } from '@/shared/ui/tab-bar';
import { useScrollMemory } from '@/shared/hooks/useScrollMemory';
import { formatCount } from '@/shared/utils/format';
import { getNcmImageUrl } from '@/shared/utils/image';
import type { Playlist } from '@/shared/types/uiModels';
import { useUserViewModel } from './hooks/useUserViewModel';

type TabKey = 'created' | 'favorited';

/* ------------------------------------------------------------------ */
/*  骨架屏                                                             */
/* ------------------------------------------------------------------ */

const PlaylistCardSkeleton = () => (
  <div className="w-42 shrink-0 box-content m-1 lg:w-44 xl:w-48">
    <Skeleton className="aspect-square w-full rounded-lg" shimmer />
    <div className="pt-2.5 space-y-1.5">
      <Skeleton className="h-3.5 w-4/5" shimmer />
      <Skeleton className="h-3 w-2/5" shimmer />
    </div>
  </div>
);

const UserSkeleton = () => (
  <ScrollArea className="h-full py-8 pl-8 pr-4">
    <div className="space-y-8">
      <div className="flex gap-8 items-center">
        <Skeleton className="size-40 shrink-0 rounded-full" shimmer />
        <div className="flex-1 min-w-0 space-y-4">
          <Skeleton className="h-9 w-56 rounded" shimmer />
          <Skeleton className="h-4 w-72 rounded" shimmer />
          <div className="flex gap-5">
            <Skeleton className="h-4 w-16 rounded" shimmer />
            <Skeleton className="h-4 w-16 rounded" shimmer />
            <Skeleton className="h-4 w-16 rounded" shimmer />
          </div>
        </div>
      </div>
      <div className="space-y-4">
        <Skeleton className="h-9 w-48 rounded" shimmer />
        <div className="flex flex-wrap gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            // oxlint-disable-next-line react/no-array-index-key
            <PlaylistCardSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  </ScrollArea>
);

/* ------------------------------------------------------------------ */
/*  页面主体                                                           */
/* ------------------------------------------------------------------ */

const Section = ({
  title,
  playlists,
}: {
  title: string;
  playlists: Playlist[];
}) => {
  if (playlists.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-2">
        <UserIcon className="size-8 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">暂无{title}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-4">
      {playlists.map((playlist) => (
        <PlaylistCard key={playlist.id} playlist={playlist} />
      ))}
    </div>
  );
};

/**
 * 用户主页（二级页）：头像 / 昵称 / 等级 / 签名 / 关注数据 + 创建与收藏的歌单。
 *
 * 与歌手页、专辑页同构：头部位 + 分类条 + 内容区；歌单卡片复用 `PlaylistCard`，
 * 点进去就是歌单详情（`playlist/:id`），形成「搜索 / 评论 → 用户 → 歌单 → 歌曲」的跳转闭环。
 */
export default function UserPage() {
  const { id } = useParams<{ id: string }>();
  const resolvedId = Number(id);
  const [activeTab, setActiveTab] = useState<TabKey>('created');
  const scrollRef = useScrollMemory();

  if (!resolvedId) throw new Error('无效的用户 ID');

  const { user, detail, created, favorited, isPending, playlistsPending } =
    useUserViewModel(resolvedId);

  usePageTitle(user?.nickname);

  if (isPending) return <UserSkeleton />;

  if (!user) return null;

  const tabs: TabBarItem<TabKey>[] = [
    { key: 'created', label: '创建的歌单', badge: created.length || undefined },
    {
      key: 'favorited',
      label: '收藏的歌单',
      badge: favorited.length || undefined,
    },
  ];

  const stats = [
    { label: '关注', value: user.follows },
    { label: '粉丝', value: user.followeds },
    { label: '歌单', value: detail?.playlistCount },
    { label: '听歌', value: detail?.listenSongs },
  ].filter((s) => s.value != null);

  return (
    <ScrollArea className="h-full py-8 pl-8 pr-4" ref={scrollRef}>
      <div className="space-y-8">
        {/* ═══ Header ═══ */}
        <header className="flex gap-8 items-center">
          {user.avatarUrl ? (
            <DecodedImage
              alt={user.nickname}
              className="size-full object-cover"
              containerClassName="size-40 shrink-0 rounded-full shadow-lg shadow-black/10 dark:shadow-black/30"
              src={getNcmImageUrl(user.avatarUrl, 300)}
            />
          ) : (
            <span className="size-40 shrink-0 rounded-full bg-muted flex items-center justify-center">
              <UserIcon className="size-12 text-muted-foreground" />
            </span>
          )}

          <div className="flex-1 min-w-0 space-y-3">
            <div className="flex items-center gap-2 min-w-0">
              <h1 className="truncate text-2xl font-bold tracking-tight">
                {user.nickname}
              </h1>
              {detail?.level != null && (
                <span className="shrink-0 rounded-md border border-primary/20 px-2 py-0.5 text-xs font-medium text-primary/80">
                  Lv.{detail.level}
                </span>
              )}
            </div>

            {user.signature && (
              <div className="max-w-xl">
                <ExpandableText text={user.signature} />
              </div>
            )}

            {stats.length > 0 && (
              <div className="flex items-center gap-5 text-sm">
                {stats.map((s) => (
                  <span className="flex items-baseline gap-1.5" key={s.label}>
                    <span className="font-medium tabular-nums text-primary">
                      {formatCount(s.value as number)}
                    </span>
                    <span className="text-muted-foreground">{s.label}</span>
                  </span>
                ))}
              </div>
            )}
          </div>
        </header>

        {/* ═══ 内容 ═══ */}
        <div className="space-y-4">
          <TabBar active={activeTab} items={tabs} onChange={setActiveTab} />

          {playlistsPending ? (
            <div className="flex flex-wrap gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                // oxlint-disable-next-line react/no-array-index-key
                <PlaylistCardSkeleton key={i} />
              ))}
            </div>
          ) : activeTab === 'created' ? (
            <Section playlists={created} title="创建的歌单" />
          ) : (
            <Section playlists={favorited} title="收藏的歌单" />
          )}
        </div>
      </div>
    </ScrollArea>
  );
}
