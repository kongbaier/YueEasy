import { useSuspenseQuery } from "@tanstack/react-query";
import { HorizontalCarousel } from "@/shared/ui/carousel";
import { PlaylistCard, toPlaylistDisplay } from "@/shared/ui/playlist-card";
import { ncm } from "@/tauri/ncm";
import { CacheKeys, cachedFetch } from "@/tauri/cache";

export const PersonalizedPlaylists = () => {
  const { data: playlists } = useSuspenseQuery({
    queryKey: ["personalizedPlaylist"],
    queryFn: () =>
      cachedFetch(CacheKeys.personalized, () => ncm.personalizedPlaylist(20))
        .then((r) => r.data.result.map(toPlaylistDisplay))
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
