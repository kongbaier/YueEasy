import { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { LoginDialog } from "@/features/auth/LoginDialog";
import { Skeleton } from "@/shared/ui/skeleton";
import { AppLayout } from "./layout";

const Home = lazy(() => import("@/features/home"));
const Search = lazy(() => import("@/features/search"));
const Playlist = lazy(() => import("@/features/playlist/Playlist"));
const Album = lazy(() => import("@/features/album/Album"));
const DailyRecommend = lazy(
  () => import("@/features/daily-recommend/DailyRecommend"),
);
const LikedSongs = lazy(() => import("@/features/liked-songs/LikedSongs"));
const RecentPlays = lazy(() => import("@/features/recent-plays/RecentPlays"));
const Settings = lazy(() => import("@/features/settings/Settings"));
const PlayerPage = lazy(() => import("@/features/player/pages/PlayerPage"));

const PageFallback = (
  <div className="p-6 space-y-4">
    <Skeleton className="h-7 w-48 rounded" shimmer />
    <Skeleton className="h-40 w-full rounded-xl" shimmer />
    <Skeleton className="h-4 w-3/4 rounded" shimmer />
  </div>
);

const Page = ({ element }: { element: React.ReactNode }) => (
  <Suspense fallback={PageFallback}>{element}</Suspense>
);

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element=<AppLayout />>
          <Route element=<Page element=<Home /> /> index />
          <Route element=<Page element=<Search /> /> path="search" />
          <Route element=<Page element=<Album /> /> path="album/:id" />
          <Route element=<Page element=<Playlist /> /> path="playlist/:id" />
          <Route element=<Page element=<DailyRecommend /> /> path="daily" />
          <Route element=<Page element=<LikedSongs /> /> path="my/liked" />
          <Route element=<Page element=<RecentPlays /> /> path="my/recent" />
          <Route element=<Page element=<Settings /> /> path="settings" />
        </Route>
      </Routes>
      <PlayerPage />
      <LoginDialog />
    </BrowserRouter>
  );
}
