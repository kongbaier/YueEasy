import { useQuery } from "@tanstack/react-query";
import { HorizontalScrollSection } from "@/components/HorizontalScrollSection";
import { ParallaxCarousel } from "@/components/ParallaxCarousel";
import { PlaylistCard, toPlaylistDisplay } from "@/components/PlaylistCard";
import { ncm } from "@/services/ncm";

export function Home() {
  const bannerQuery = useQuery({
    queryKey: ["banner"],
    queryFn: () => ncm.banner().then((r) => r.banners),
  });

  const personalizedQuery = useQuery({
    queryKey: ["personalizedPlaylist"],
    queryFn: () =>
      ncm.personalizedPlaylist(20).then((r) => r.result.map(toPlaylistDisplay)),
  });

  const topPlaylistQuery = useQuery({
    queryKey: ["topPlaylist", "全部"],
    queryFn: () =>
      ncm
        .topPlaylist("全部", 20)
        .then((r) => r.playlists.map(toPlaylistDisplay)),
  });

  const isLoading =
    bannerQuery.isPending ||
    personalizedQuery.isPending ||
    topPlaylistQuery.isPending;

  if (isLoading) {
    return <div className="p-6 text-sm text-muted-foreground">加载中...</div>;
  }

  if (
    bannerQuery.isError &&
    personalizedQuery.isError &&
    topPlaylistQuery.isError
  ) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold">发现音乐</h1>
        <p className="mt-4 text-sm text-red-500">加载失败</p>
      </div>
    );
  }

  const banners = bannerQuery.data ?? [];
  const playlists = personalizedQuery.data ?? [];
  const topPlaylists = topPlaylistQuery.data ?? [];

  return (
    <div className="space-y-8 px-6 pb-3">
      <div className="grid grid-rows-2 grid-cols-5 w-full aspect-9/2 gap-4">
        <div className="row-span-2 col-span-3">
          <ParallaxCarousel
            className="rounded-xl"
            items={banners}
            parallaxSpeed={0.25}
            renderItem={(banner, _index, parallaxOffset, isAnimating) => (
              <button
                className="relative w-full h-full overflow-hidden"
                type="button"
              >
                <img
                  alt={banner.typeTitle}
                  className="absolute top-0 max-w-none"
                  src={banner.imageUrl}
                  style={{
                    width: "100%",
                    left: "50%",
                    transform: `translateX(calc(-50% + ${parallaxOffset * 64.5}%))`,
                    transition: isAnimating
                      ? "transform 700ms ease-out"
                      : "none",
                  }}
                />
                {/*<span
                  className="absolute right-2 bottom-2 rounded bg-black/50 px-2 py-0.5 text-xs"
                  style={{ color: banner.titleColor }}
                >
                  {banner.typeTitle}
                </span>*/}
              </button>
            )}
          />
        </div>

        <div className="row-span-1 col-span-2 bg-amber-300"></div>
        <div className="row-span-1 col-span-1 bg-emerald-400"></div>
        <div className="row-span-1 col-span-1 bg-pink-400"></div>
        {/*<div className="hidden lg:flex lg:w-2/5 lg:flex-col lg:gap-3">
          <QuickEntry
            className="flex-1"
            icon={Sparkles}
            subtitle="每日歌曲推荐"
            title="每日推荐"
            to="/daily"
          />
          <div className="flex flex-1 gap-3">
            <QuickEntry className="flex-1" icon={Antenna} title="私人雷达" />
            <QuickEntry
              className="flex-1"
              icon={Radio}
              onClick={handlePersonalFm}
              title="私人漫游"
            />
          </div>
        </div>*/}
      </div>

      <HorizontalScrollSection
        title="推荐歌单"
        titleLink="/discover/personalized"
      >
        {playlists.map((pl) => (
          <PlaylistCard key={pl.id} playlist={pl} showPlayCount />
        ))}
      </HorizontalScrollSection>

      <HorizontalScrollSection title="热门歌单" titleLink="/discover/toplist">
        {topPlaylists.map((pl) => (
          <PlaylistCard key={pl.id} playlist={pl} />
        ))}
      </HorizontalScrollSection>
    </div>
  );
}
