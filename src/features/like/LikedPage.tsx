import { useState } from 'react';
import { Heart } from 'lucide-react';
import { usePageTitle } from '@/app/layout/PageTitleContext';
import { Button } from '@/shared/ui/button';
import { ScrollArea } from '@/shared/ui/scroll-area';
import { TrackRow, TrackRowSkeletonList } from '@/shared/components/track';
import { useScrollMemory } from '@/shared/hooks/useScrollMemory';
import { CommentPanel } from '@/features/comment/components';
import { TabBar, type TabKey } from '@/features/playlist/components/TabBar';
import {
  PlaylistInfo,
  PlaylistInfoSkeleton,
} from '@/features/playlist/components/PlaylistInfo';
import { useAuthViewModel } from '@/features/auth/hooks/useAuthViewModel';
import { useLikedSongsViewModel } from './hooks/useLikedSongsViewModel';

const LikedSkeleton = () => (
  <ScrollArea className="h-full py-8 pl-8 pr-4">
    <div className="space-y-8">
      <PlaylistInfoSkeleton />
      <div className="space-y-4">
        <TabBar active="songs" onChange={() => {}} />
        <TrackRowSkeletonList />
      </div>
    </div>
  </ScrollArea>
);

/**
 * 「我喜欢」页：不再重定向到 `playlist/:id` 浅封装歌单详情（那是静态快照，
 * 在本页经由播放栏喜欢一首歌时列表不会更新），而是带乐观添加的独立查询。
 * 列表语义是「动态添加、延迟清除」（详见 useLikedSongsViewModel）。
 *
 * 取数走非 Suspense 的 useQuery（见 useLikedSongsViewModel），登录门禁 / 加载骨架 /
 * 空态全部由 early return 承载；所有 hook 都在 early return 之前调用，
 * 保证登录态翻转时 hook 数量不变。滚动位置由 useScrollMemory 记忆（见 AGENTS.md §8）。
 */
export default function LikedPage() {
  usePageTitle('我的喜欢', { root: true });
  const scrollRef = useScrollMemory();
  const [activeTab, setActiveTab] = useState<TabKey>('songs');
  const { isLoggedIn, userId, openLogin } = useAuthViewModel();

  const { playlist, songs, isPending, handlePlay, handlePlayAll } =
    useLikedSongsViewModel(isLoggedIn ? userId : null);

  if (!isLoggedIn) {
    return (
      <div
        className="flex flex-col items-center justify-center h-full gap-4"
        data-focus-zone
      >
        <Heart className="h-12 w-12 text-muted-foreground" />
        <p className="text-muted-foreground">登录后查看我喜欢</p>
        <Button onClick={openLogin}>立即登录</Button>
      </div>
    );
  }

  if (isPending || !playlist) return <LikedSkeleton />;

  return (
    <ScrollArea className="h-full py-8 pl-8 pr-4" ref={scrollRef}>
      <div className="space-y-8">
        {/* ═══ Header ═══ */}
        <PlaylistInfo onPlayAll={handlePlayAll} playlist={playlist} />

        <div className="space-y-4">
          <TabBar
            active={activeTab}
            commentCount={playlist.commentCount}
            onChange={setActiveTab}
            songCount={songs.length}
          />
          {activeTab === 'songs' ? (
            songs.length > 0 ? (
              <div className="space-y-0.5" data-focus-zone>
                {songs.map((track, index) => (
                  <TrackRow
                    index={index}
                    key={track.id}
                    onPlay={handlePlay}
                    track={track}
                  />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center gap-2 py-20">
                <Heart className="h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">还没有喜欢的歌曲</p>
              </div>
            )
          ) : (
            <CommentPanel playlistId={playlist.id} />
          )}
        </div>
      </div>
    </ScrollArea>
  );
}
