import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { CommentPanel } from '@/features/comment/components';
import { TrackRow, TrackRowSkeletonList } from '@/shared/components/track';
import { ScrollArea } from '@/shared/ui/scroll-area';
import { useScrollMemory } from '@/shared/hooks/useScrollMemory';
import { usePlaylistViewModel } from './hooks/usePlaylistViewModel';
import { PlaylistInfo, PlaylistInfoSkeleton } from './components/PlaylistInfo';
import { usePageTitle } from '@/app/layout/PageTitleContext';
import type { TabKey } from './components/TabBar';
import { TabBar } from './components/TabBar';

const PlaylistSkeleton = () => (
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
 * 歌单详情页：id 一律来自路由参数 `:id`。
 * 「我喜欢」不走这里（见 `features/like/LikedPage`）：它需要「页内喜欢立刻出现」的
 * 动态添加语义，而歌单详情只是服务端快照。
 */
export default function PlaylistPage() {
  const { id } = useParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState<TabKey>('songs');
  const scrollRef = useScrollMemory();

  const resolvedId = Number(id);

  if (!resolvedId) throw new Error('无效的歌单 ID');

  const { playlist, handlePlay, handlePlayAll, isPending } =
    usePlaylistViewModel(resolvedId);

  usePageTitle(playlist?.name);

  if (isPending) return <PlaylistSkeleton />;

  if (!playlist) return;

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
            songCount={playlist.trackCount}
          />
          {activeTab === 'songs' ? (
            /* 歌曲列表 */
            playlist.tracks &&
            playlist.tracks.length > 0 && (
              <div className="space-y-0.5" data-focus-zone>
                {playlist.tracks.map((track, index) => (
                  <TrackRow
                    index={index}
                    key={track.id}
                    onPlay={handlePlay}
                    track={track}
                  />
                ))}
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
