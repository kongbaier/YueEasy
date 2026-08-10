import { Loader2, Play, Radar, Radio } from "lucide-react";
import React, { useRef } from "react";
import { useContainerWidth } from "@/shared/hooks/useContainerWidth";
import { ParallaxCarousel } from "@/shared/ui/carousel";
import { Skeleton } from "@/shared/ui/skeleton";
import { SmartImage } from "@/shared/ui/image";
import { useFmCardViewModel } from "../hooks/useFmCardViewModel";
import { useHomeBannerViewModel } from "../hooks/useHomeBannerViewModel";
import { useRadarCardViewModel } from "../hooks/useRadarCardViewModel";

const WIDE_BREAKPOINT = 672; // 与 CSS @min-2xl: 对齐（64rem = 1024px，按默认 16px 根字号）

const BannerCarousel = () => {
  const { banners } = useHomeBannerViewModel();
  return (
    <>
      <ParallaxCarousel
        className="relative rounded-xl size-full overflow-hidden shadow-lg dark:shadow-none ring-1 ring-gray-300 dark:ring-white/10"
        getKey={(item) => item.bigImageUrl}
        items={banners}
      >
        {(banner) => {
          return (
            <React.Fragment>
              <SmartImage
                alt={banner.typeTitle}
                className="size-full object-cover"
                containerClassName="absolute inset-0"
                decoding="async"
                loading="eager"
                src={banner.bigImageUrl}
              />
              <div className="absolute right-3 top-3 drop-shadow-2xl text-xs bg-background rounded-sm px-1 py-0.5">
                {banner.typeTitle}
              </div>
            </React.Fragment>
          );
        }}
      </ParallaxCarousel>
    </>
  );
};

BannerCarousel.Skeleton = () => <Skeleton className="absolute inset-0 rounded-xl" shimmer />;

const FmCard = () => {
  const { isFm, displaySong, showFmSkeleton, pending, startFm } =
    useFmCardViewModel();
  const coverUrl = displaySong?.album?.picUrl;
  const songName = displaySong?.name;
  const artistNames = displaySong?.artists?.map((a) => a.name).join(" / ");

  return (
    <div
      className="row-span-1 col-span-2 group relative cursor-pointer overflow-hidden rounded-xl shadow-lg dark:shadow-none dark:ring-1 dark:ring-white/10 transition duration-300 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
      onClick={() => startFm(true)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          startFm(true);
        }
      }}
      role="button"
      tabIndex={0}
    >
      {showFmSkeleton ? (
        <Skeleton className="absolute inset-0 rounded-xl" shimmer />
      ) : (
        <>
          {coverUrl ? (
            <>
              {/* 封面清晰铺底：object-cover 完整展示，不加整体 blur */}
              <SmartImage
                alt={songName ?? "私人漫游"}
                className="size-full object-cover"
                containerClassName="absolute inset-0"
                decoding="async"
                src={coverUrl}
              />
              {/* 底部 40% 高度遮罩：mask 纵向渐变让 blur 由下至上渐隐，颜色也随渐变融合 */}
              <div className="absolute bottom-0 left-0 right-0 h-[40%] bg-linear-to-t from-black/80 via-black/40 to-transparent backdrop-blur-sm mask-[linear-gradient(to_top,black,transparent)] `mask-size-[100%_100%]" />
            </>
          ) : (
            <>
              {/* 无封面兜底：暖棕红渐变 + 品牌红辉光 + Radio 水印 */}
              <div className="absolute inset-0 bg-linear-to-br from-[#431611] via-[#6b2419] to-[#260a08]" />
              <div className="absolute -top-12 -right-6 size-52 rounded-full bg-primary/30 blur-3xl transition-colors duration-300 group-hover:bg-primary/45" />
              <Radio
                className="absolute -bottom-4 -left-4 size-28 text-white/5"
                strokeWidth={1}
              />
            </>
          )}

          {!coverUrl && (
            <div className="relative flex h-full flex-col items-center justify-center gap-1.5 px-4">
              <h3 className="text-base font-semibold tracking-wide text-white">
                私人漫游
              </h3>
              <p className="text-xs text-white/60">
                {isFm ? "正在为你播放…" : "为你持续推荐喜欢的音乐"}
              </p>
            </div>
          )}

          {coverUrl && (
            <div className="absolute left-3 bottom-3 right-16 min-w-0">
              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-white/60">
                <Radio className="size-3" />
                私人漫游
              </span>
              <p className="mt-0.5 truncate text-sm font-semibold text-white">
                {songName}
              </p>
              <p className="truncate text-xs font-normal text-white/70">
                {artistNames}
              </p>
            </div>
          )}

          {/* 右下角播放键 */}
          <button
            aria-label={isFm ? "打开私人漫游" : "开始私人漫游"}
            className="absolute right-3 bottom-3 flex size-10 md:size-11 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/40 ring-1 ring-white/20 transition-transform duration-200 hover:scale-110 active:scale-95 disabled:pointer-events-none disabled:opacity-70"
            disabled={pending}
            onClick={(e) => {
              e.stopPropagation();
              // 漫游中点击播放键视为打开播放页
              startFm(isFm);
            }}
            type="button"
          >
            {pending ? (
              <Loader2 className="size-5 animate-spin" />
            ) : (
              <Play className="ml-0.5 size-5 fill-current" />
            )}
          </button>

          {isFm && (
            <span className="absolute right-2 top-2 flex items-center gap-1.5 rounded-full bg-black/40 px-2 py-0.5 text-[10px] font-medium text-white/80 backdrop-blur-sm">
              <span className="size-1.5 animate-pulse rounded-full bg-primary" />
              播放中
            </span>
          )}
        </>
      )}
    </div>
  );
};

FmCard.Skeleton = () => (
  <div className="row-span-1 col-span-2 relative rounded-xl shadow-lg dark:shadow-none dark:ring-1 dark:ring-white/10">
    <Skeleton className="absolute inset-0 rounded-xl" shimmer />
  </div>
);

// 私人雷达卡片：首页圆形入口里的"私人雷达"歌单，点击跳转歌单页
const RadarCard = () => {
  const { isLoggedIn, coverUrl, playlistName, showRadarSkeleton, goRadar } =
    useRadarCardViewModel();

  return (
    <div
      className="row-span-1 col-span-1 group relative cursor-pointer overflow-hidden rounded-xl shadow-lg dark:shadow-none dark:ring-1 dark:ring-white/10 transition duration-300 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
      onClick={goRadar}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          goRadar();
        }
      }}
      role="button"
      tabIndex={0}
    >
      {showRadarSkeleton ? (
        <Skeleton className="absolute inset-0 rounded-xl" shimmer />
      ) : (
        <>
          {coverUrl ? (
            <>
              <SmartImage
                alt={playlistName}
                className="size-full object-cover"
                containerClassName="absolute inset-0"
                decoding="async"
                src={coverUrl}
              />
              <div className="absolute bottom-0 left-0 right-0 h-[45%] bg-linear-to-t from-black/80 via-black/40 to-transparent backdrop-blur-sm mask-[linear-gradient(to_top,black,transparent)] mask-size-[100%_100%]" />
            </>
          ) : (
            <>
              {/* 无封面兜底：雷达蓝渐变 + 品牌红辉光 + Radar 水印 */}
              <div className="absolute inset-0 bg-linear-to-br from-[#12303f] via-[#14546e] to-[#081820]" />
              <div className="absolute -top-10 -right-4 size-40 rounded-full bg-primary/25 blur-3xl transition-colors duration-300 group-hover:bg-primary/40" />
              <Radar
                className="absolute -bottom-3 -left-3 size-24 text-white/5"
                strokeWidth={1}
              />
            </>
          )}

          {coverUrl ? (
            <div className="absolute left-3 bottom-3 right-3 min-w-0">
              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-white/60">
                <Radar className="size-3" />
                私人雷达
              </span>
              <p className="mt-0.5 truncate text-sm font-semibold text-white">
                {playlistName}
              </p>
            </div>
          ) : (
            <div className="relative flex h-full flex-col items-center justify-center gap-1.5 px-4 text-center">
              <h3 className="text-base font-semibold tracking-wide text-white">
                私人雷达
              </h3>
              <p className="text-xs text-white/60">
                {isLoggedIn ? "为你定制专属歌单" : "登录后使用"}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
};

RadarCard.Skeleton = () => (
  <div className="row-span-1 col-span-1 relative rounded-xl shadow-lg dark:shadow-none dark:ring-1 dark:ring-white/10">
    <Skeleton className="absolute inset-0 rounded-xl" shimmer />
  </div>
);

// 心动模式暂未启用，该位置预留占位：与其它卡片一致的 shimmer 骨架
const HeartbeatPlaceholder = () => {
  return (
    <div className="row-span-1 col-span-1 relative rounded-xl shadow-lg dark:shadow-none dark:ring-1 dark:ring-white/10">
      <Skeleton className="absolute inset-0 rounded-xl" shimmer />
    </div>
  );
};

const BannerGrid = ({
  children,
  containerRef,
}: {
  children: React.ReactNode;
  containerRef?: React.RefObject<HTMLDivElement | null>;
}) => (
  <div ref={containerRef} className="@container">
    <div className="w-full grid grid-rows-2 grid-cols-5 aspect-9/5 @min-2xl:aspect-3/1 gap-2 @min-2xl:gap-3 @min-3xl:gap-4">
      {children}
    </div>
  </div>
);

export const Banner = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  // 容器宽度断点，与 CSS @[64rem]: 对齐（1024px）
  const isWide = useContainerWidth(containerRef) >= WIDE_BREAKPOINT;

  return (
    <BannerGrid containerRef={containerRef}>
      <div className="row-span-2 col-span-5 @min-2xl:col-span-3 relative">
        <BannerCarousel />
      </div>

      {isWide && (
        <React.Fragment>
          <FmCard />
          <RadarCard />
          <HeartbeatPlaceholder />
        </React.Fragment>
      )}
    </BannerGrid>
  );
};

// 供页面级 Suspense 使用：Banner 的数据（useSuspenseQuery）在其自身渲染期间挂起，
// 只能由 Banner 上层的 Suspense 捕获，故该骨架只在页面处使用一次。
Banner.Skeleton = () => (
  <BannerGrid>
    <div className="row-span-2 col-span-5 @min-2xl:col-span-3 relative">
      <BannerCarousel.Skeleton />
    </div>
    <div className="hidden @min-2xl:contents">
      <FmCard.Skeleton />
      <RadarCard.Skeleton />
      <HeartbeatPlaceholder />
    </div>
  </BannerGrid>
);
