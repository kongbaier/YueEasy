import { HorizontalCarousel } from '@/shared/ui/carousel';
import { PlaylistCard } from '@/shared/components/playlist-card';
import { usePersonalizedPlaylistsViewModel } from '../hooks/usePersonalizedPlaylistsViewModel';

export const PersonalizedPlaylists = () => {
  const { playlists } = usePersonalizedPlaylistsViewModel();

  return (
    <HorizontalCarousel title="推荐歌单" titleLink="/discover/personalized">
      {playlists.map((pl) => (
        <PlaylistCard key={pl.id} playlist={pl} showPlayCount />
      ))}
    </HorizontalCarousel>
  );
};
