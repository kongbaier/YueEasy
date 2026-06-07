import { useMediaQuery } from "@base-ui/react/unstable-use-media-query";
import { useSuspenseQuery } from "@tanstack/react-query";
import React, { Suspense, useEffect, useState } from "react";
import { ParallaxCarousel } from "@/components/common/carousel/ParallaxCarousel";
import { HorizontalScrollSection } from "@/components/HorizontalScrollSection";
import { PlaylistCard, toPlaylistDisplay } from "@/components/PlaylistCard";
import { Skeleton } from "@/components/ui/skeleton";
import { BannerType, ncm } from "@/services/ncm";

function BannerSection() {
  const { data: banners } = useSuspenseQuery({
    queryKey: ["banner"],
    queryFn: () =>
      ncm
        .banner()
        .then((r) =>
          r.banners.filter((banner) => banner.targetType !== BannerType.AD),
        )
        .catch(() => []),
  });

  const isWide = useMediaQuery("(min-width: 1024px)", {});
  const [imagesReady, setImagesReady] = useState(false);

  useEffect(() => {
    setImagesReady(false);
    if (banners.length === 0) {
      setImagesReady(true);
      return;
    }
    let cancelled = false;
    Promise.allSettled(
      banners.map(
        (b) =>
          new Promise<void>((resolve) => {
            const img = new Image();
            img.src = b.bigImageUrl;
            img.decode().then(() => resolve());
          }),
      ),
    ).then(() => {
      if (!cancelled) setImagesReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [banners]);

  if (!imagesReady) return <BannerFallback />;

  return (
    <div className="grid grid-rows-2 grid-cols-5 w-full aspect-9/5 lg:aspect-3/1 gap-2 md:gap-3 lg:gap-4">
      <ParallaxCarousel
        className="row-span-2 col-span-5 lg:col-span-3 rounded-xl shadow-lg dark:shadow-none dark:ring-1 dark:ring-white/10 overflow-hidden"
        getKey={(item) => item.bigImageUrl}
        items={banners}
      >
        {(banner) => {
          return (
            <React.Fragment>
              <img
                alt={banner.typeTitle}
                className="absolute inset-0 w-full h-full object-cover"
                src={banner.bigImageUrl}
              />
              <div className="absolute right-3 top-3 drop-shadow-2xl text-xs bg-background rounded-sm px-1 py-0.5">
                {banner.typeTitle}
              </div>
            </React.Fragment>
          );
        }}
      </ParallaxCarousel>

      {isWide && (
        <React.Fragment>
          <div className="row-span-1 col-span-2 bg-amber-300 rounded-xl shadow-lg dark:shadow-none dark:ring-1 dark:ring-white/10 block" />
          <div className="row-span-1 col-span-1 bg-emerald-400 rounded-xl shadow-lg dark:shadow-none dark:ring-1 dark:ring-white/10 block" />
          <div className="row-span-1 col-span-1 bg-pink-400 rounded-xl shadow-lg dark:shadow-none dark:ring-1 dark:ring-white/10 block" />
        </React.Fragment>
      )}
    </div>
  );
}

function BannerFallback() {
  return (
    <div className="grid grid-rows-2 grid-cols-5 w-full aspect-9/5 lg:aspect-3/1 gap-2 md:gap-3 lg:gap-4">
      <div className="row-span-2 col-span-5 lg:col-span-3">
        <Skeleton className="h-full w-full rounded-xl" shimmer />
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
    <HorizontalScrollSection
      title="推荐歌单"
      titleLink="/discover/personalized"
    >
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
    <div className="space-y-8 px-6 py-3">
      <Suspense fallback={<BannerFallback />}>
        <BannerSection />
      </Suspense>

      <Suspense fallback={<HorizontalScrollSection loading title="推荐歌单" />}>
        <PersonalizedSection />
      </Suspense>

      <Suspense fallback={<HorizontalScrollSection loading title="热门歌单" />}>
        <TopPlaylistSection />
      </Suspense>
    </div>
  );
}
