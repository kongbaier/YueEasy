import { HorizontalCarousel } from '@/shared/ui/carousel';
import { PlaylistCard } from '@/shared/components/playlist-card';
import { useTopPlaylistsViewModel } from '../hooks/useTopPlaylistsViewModel';

export const TopPlaylists = () => {
  const { topPlaylists, isLoading } = useTopPlaylistsViewModel();

  return (
    <HorizontalCarousel
      loading={isLoading}
      title="热门歌单"
      titleLink="/discover/toplist"
    >
      {(topPlaylists ?? []).map((pl) => (
        <PlaylistCard key={pl.id} playlist={pl} />
      ))}
    </HorizontalCarousel>
  );
};
