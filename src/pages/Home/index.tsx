import { Suspense } from "react";
import { HorizontalCarousel } from "@/components/common/carousel";
import { Banner, BannerFallback } from "./Banner";
import { PersonalizedPlaylists } from "./PersonalizedPlaylists";
import { TopPlaylists } from "./TopPlaylists";

export default function Home() {
  return (
    <div className="space-y-8 px-6 py-3">
      <Suspense fallback={<BannerFallback />}>
        <Banner />
      </Suspense>

      <Suspense fallback={<HorizontalCarousel loading title="推荐歌单" />}>
        <PersonalizedPlaylists />
      </Suspense>

      <Suspense fallback={<HorizontalCarousel loading title="热门歌单" />}>
        <TopPlaylists />
      </Suspense>
    </div>
  );
}
