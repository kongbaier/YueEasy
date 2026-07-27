import { useSuspenseQuery } from "@tanstack/react-query";
import { HorizontalCarousel } from "@/shared/ui/carousel";
import { PlaylistCard, toPlaylistDisplay } from "@/shared/ui/playlist-card";
import { ncm } from "@/shared/services/ncm";
import { CacheKeys, cachedFetch } from "@/shared/services/cache";

export const TopPlaylists = () => {
  const { data: topPlaylists } = useSuspenseQuery({
    queryKey: ["topPlaylist", "全部"],
    queryFn: () =>
      cachedFetch(CacheKeys.topPlaylists("全部"), () =>
        ncm.topPlaylist("全部", 20),
      )
        .then((r) => r.data.playlists.map(toPlaylistDisplay))
        .catch(() => []),
  });

  return (
    <HorizontalCarousel title="热门歌单" titleLink="/discover/toplist">
      {topPlaylists.map((pl) => (
        <PlaylistCard key={pl.id} playlist={pl} />
      ))}
    </HorizontalCarousel>
  );
};
