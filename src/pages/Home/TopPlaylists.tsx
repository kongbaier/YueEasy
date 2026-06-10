import { useSuspenseQuery } from "@tanstack/react-query";
import { HorizontalCarousel } from "@/components/common/carousel";
import { PlaylistCard, toPlaylistDisplay } from "@/components/playlist-card";
import { ncm } from "@/services/ncm";

export const TopPlaylists = () => {
  const { data: topPlaylists } = useSuspenseQuery({
    queryKey: ["topPlaylist", "全部"],
    queryFn: () =>
      ncm
        .topPlaylist("全部", 20)
        .then((r) => r.playlists.map(toPlaylistDisplay))
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
