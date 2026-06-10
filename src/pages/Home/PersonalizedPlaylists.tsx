import { useSuspenseQuery } from "@tanstack/react-query";
import { HorizontalCarousel } from "@/components/common/carousel";
import { PlaylistCard, toPlaylistDisplay } from "@/components/playlist-card";
import { ncm } from "@/services/ncm";

export const PersonalizedPlaylists = () => {
  const { data: playlists } = useSuspenseQuery({
    queryKey: ["personalizedPlaylist"],
    queryFn: () =>
      ncm
        .personalizedPlaylist(20)
        .then((r) => r.result.map(toPlaylistDisplay))
        .catch(() => []),
  });

  return (
    <HorizontalCarousel title="推荐歌单" titleLink="/discover/personalized">
      {playlists.map((pl) => (
        <PlaylistCard key={pl.id} playlist={pl} showPlayCount />
      ))}
    </HorizontalCarousel>
  );
};
