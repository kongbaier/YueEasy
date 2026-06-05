import { useMediaQuery } from "@base-ui/react/unstable-use-media-query";
import { useSuspenseQuery } from "@tanstack/react-query";
import React, { Suspense } from "react";
import { HorizontalScrollSection } from "@/components/HorizontalScrollSection";
import { ParallaxCarousel } from "@/components/ParallaxCarousel";
import { PlaylistCard, toPlaylistDisplay } from "@/components/PlaylistCard";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { ncm } from "@/services/ncm";

function BannerSection() {
  const { data: banners } = useSuspenseQuery({
    queryKey: ["banner"],
    queryFn: () =>
      ncm
        .banner()
        .then((r) => r.banners)
        .catch(() => []),
  });

  const isWide = useMediaQuery("(min-width: 1024px)", {});

  return (
    <div className="grid grid-rows-2 grid-cols-5 w-full aspect-9/5 lg:aspect-3/1 gap-2 md:gap-3 lg:gap-4">
      <div className="row-span-2 col-span-5 lg:col-span-3">
        <ParallaxCarousel
          className="rounded-xl shadow-lg"
          items={banners}
          parallaxSpeed={0.25}
        >
          {(banner, _index, parallaxOffset) => (
            <button className="w-full h-full overflow-hidden" type="button">
              <img
                alt={banner.typeTitle}
                className={cn(
                  "block inset-0",
                  "transition-transform duration-700 ease-out",
                )}
                src={banner.bigImageUrl}
                style={{
                  transform: `translateX(calc( ${parallaxOffset * 90}%))`,
                }}
              />
              <span className="absolute right-2 top-2 rounded px-2 py-1 text-xs leading-3 bg-background/50 backdrop-blur-xl text-foreground">
                {banner.typeTitle}
              </span>
            </button>
          )}
        </ParallaxCarousel>
      </div>

      {isWide && (
        <React.Fragment>
          <div className="row-span-1 col-span-2 bg-amber-300 rounded-xl shadow-lg block" />
          <div className="row-span-1 col-span-1 bg-emerald-400 rounded-xl shadow-lg block" />
          <div className="row-span-1 col-span-1 bg-pink-400 rounded-xl shadow-lg block" />
        </React.Fragment>
      )}
    </div>
  );
}

function BannerFallback() {
  return (
    <div className="grid grid-rows-2 grid-cols-5 w-full aspect-9/5 lg:aspect-3/1 gap-2 md:gap-3 lg:gap-4">
      <div className="row-span-2 col-span-5 lg:col-span-3">
        <ParallaxCarousel className="rounded-xl" items={[]} loading />
      </div>
      <div className="hidden lg:contents">
        <Skeleton className="row-span-1 col-span-2 rounded-xl" shimmer />
        <Skeleton className="row-span-1 col-span-1 rounded-xl" shimmer />
        <Skeleton className="row-span-1 col-span-1 rounded-xl" shimmer />
      </div>
    </div>
  );
}

function PersonalizedSection() {
  const { data: playlists } = useSuspenseQuery({
    queryKey: ["personalizedPlaylist"],
    queryFn: () =>
      ncm
        .personalizedPlaylist(20)
        .then((r) => r.result.map(toPlaylistDisplay))
        .catch(() => []),
  });

  return (
    <HorizontalScrollSection title="推荐歌单" titleLink="/discover/personalized">
      {playlists.map((pl) => (
        <PlaylistCard key={pl.id} playlist={pl} showPlayCount />
      ))}
    </HorizontalScrollSection>
  );
}

function TopPlaylistSection() {
  const { data: topPlaylists } = useSuspenseQuery({
    queryKey: ["topPlaylist", "全部"],
    queryFn: () =>
      ncm
        .topPlaylist("全部", 20)
        .then((r) => r.playlists.map(toPlaylistDisplay))
        .catch(() => []),
  });

  return (
    <HorizontalScrollSection title="热门歌单" titleLink="/discover/toplist">
      {topPlaylists.map((pl) => (
        <PlaylistCard key={pl.id} playlist={pl} />
      ))}
    </HorizontalScrollSection>
  );
}

export default function Home() {
  return (
    <div className="space-y-8 px-6 pb-3">
      <Suspense fallback={<BannerFallback />}>
        <BannerSection />
      </Suspense>

      <Suspense
        fallback={<HorizontalScrollSection loading title="推荐歌单" />}
      >
        <PersonalizedSection />
      </Suspense>

      <Suspense
        fallback={<HorizontalScrollSection loading title="热门歌单" />}
      >
        <TopPlaylistSection />
      </Suspense>
    </div>
  );
}
