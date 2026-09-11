import { Suspense, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CommentPanel, CommentSkeleton } from '@/modules/comment/components';
import { TrackRow, TrackRowSkeleton } from '@/shared/components/track';
import { usePlaylistViewModel } from './usePlaylistViewModel';
import { PlaylistInfo } from './components/PlaylistInfo';
import { usePageTitle } from '@/app/layout/PageTitleContext';
import type { TabKey } from './components/TabBar';
import { TabBar } from './components/TabBar';

const TrackListSkeleton = () => (
  <div className="space-y-0.5">
    {Array.from({ length: 8 }).map((_, i) => (
      // oxlint-disable-next-line react/no-array-index-key
      <TrackRowSkeleton index={i} key={i} />
    ))}
  </div>
);

/**
 * Suspense fallback：只做组装，容器外形与 PlaylistContent 对齐，避免数据到达时布局跳动。
 * 页面数据来自单个 query，各区块同时就绪，故不为它们单独开 Suspense 边界。
 */
const PlaylistSkeleton = () => (
  <div className="py-8 pl-8 pr-4 space-y-8">
    <PlaylistInfo.Skeleton />
    <div className="space-y-4">
      <TabBar active="songs" onChange={() => {}} />
      <TrackListSkeleton />
    </div>
  </div>
);

interface PlaylistProps {
  /** 外部显式传入的歌单 id（如「我喜欢」复用场景）；缺省时回退路由参数 :id */
  playlistId?: number;
}

export default function PlaylistPage({ playlistId }: PlaylistProps) {
  const { id } = useParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState<TabKey>('songs');

  const resolvedId = playlistId ?? Number(id);

  if (!resolvedId) throw new Error('无效的歌单 ID');

  const { playlist, fromCache, visibleCount, handlePlay, handlePlayAll } =
    usePlaylistViewModel(resolvedId);

  usePageTitle(playlist?.name);

  // 数据未就绪（useQuery 未 suspense）：整页骨架。放在所有 hook 之后，hook 顺序稳定。
  if (!playlist) return <PlaylistSkeleton />;

  return (
    <div className="py-8 pl-8 pr-4 space-y-8">
      {/* ═══ Header ═══ */}
      <PlaylistInfo
        fromCache={fromCache}
        onPlayAll={handlePlayAll}
        playlist={playlist}
      />

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
            <div className="space-y-0.5">
              {playlist.tracks.slice(0, visibleCount).map((track, index) => (
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
          <Suspense fallback={<CommentSkeleton />}>
            <CommentPanel playlistId={playlist.id} />
          </Suspense>
        )}
      </div>
    </div>
  );
}
