import { useMediaQuery } from "@base-ui/react/unstable-use-media-query";
import { useSuspenseQuery } from "@tanstack/react-query";
import React, { useEffect, useState } from "react";
import { ParallaxCarousel } from "@/components/common/carousel";
import { Skeleton } from "@/components/ui/skeleton";
import { BannerType, ncm } from "@/services/ncm";

export const Banner = () => {
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
  const [activeIndex, setActiveIndex] = useState(0);

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

  const currentBanner = banners[activeIndex];

  return (
    <div className="grid grid-rows-2 grid-cols-5 w-full aspect-9/5 lg:aspect-3/1 gap-2 md:gap-3 lg:gap-4">
      <div className="row-span-2 col-span-5 lg:col-span-3 relative">
        {currentBanner && (
          <img
            alt=""
            aria-hidden="true"
            className="absolute inset-0 top-3 object-cover blur-lg scale-95 -z-1"
            src={currentBanner.bigImageUrl}
          />
        )}
        <ParallaxCarousel
          className="relative rounded-xl size-full overflow-hidden shadow-lg dark:shadow-none ring-1 ring-gray-300 dark:ring-white/10"
          getKey={(item) => item.bigImageUrl}
          items={banners}
          onActiveIndexChange={setActiveIndex}
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
      </div>

      {isWide && (
        <React.Fragment>
          <div className="row-span-1 col-span-2 bg-amber-300 rounded-xl shadow-lg dark:shadow-none dark:ring-1 dark:ring-white/10 block" />
          <div className="row-span-1 col-span-1 bg-emerald-400 rounded-xl shadow-lg dark:shadow-none dark:ring-1 dark:ring-white/10 block" />
          <div className="row-span-1 col-span-1 bg-pink-400 rounded-xl shadow-lg dark:shadow-none dark:ring-1 dark:ring-white/10 block" />
        </React.Fragment>
      )}
    </div>
  );
};

export const BannerFallback = () => {
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
};
