import { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";
import { useAccentColor } from "@/hooks/useAccentColor";
import { useAuthRestore } from "@/hooks/useAuthRestore";
import { useLikeInit } from "@/hooks/useLikeInit";
import { usePlayerRestore } from "@/hooks/usePlayerRestore";
import { useQueuePersistence } from "@/hooks/useQueuePersistence";
import { useThemeSync } from "@/hooks/useThemeSync";
import { useWindowDrag } from "@/hooks/useWindowDrag";
import { useWindowEffect } from "@/hooks/useWindowEffect";
import { MainLayout } from "./components/layout";
import { Skeleton } from "./components/ui/skeleton";
import "./styles/index.css";

const Home = lazy(() => import("./pages/Home"));
const Search = lazy(() => import("./pages/Search"));
const Playlist = lazy(() => import("./pages/Playlist"));
const DailyRecommend = lazy(() => import("./pages/DailyRecommend"));
const LikedSongs = lazy(() => import("./pages/LikedSongs"));
const RecentPlays = lazy(() => import("./pages/RecentPlays"));
const Settings = lazy(() => import("./pages/Settings"));
const PlayerPage = lazy(() => import("./pages/PlayerPage"));
const LoginDialog = lazy(() =>
  import("./components/LoginDialog").then((m) => ({ default: m.LoginDialog })),
);

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

function App() {
  useAccentColor();
  useAuthRestore();
  useLikeInit();
  usePlayerRestore();
  useQueuePersistence();
  useThemeSync();
  useWindowEffect();
  useWindowDrag("drag-region");

  return (
    <BrowserRouter>
      <Routes>
        <Route element=<MainLayout />>
          <Route element=<Page element=<Home /> /> index />
          <Route element=<Page element=<Search /> /> path="search" />
          <Route element=<Page element=<Playlist /> /> path="playlist/:id" />
          <Route element=<Page element=<DailyRecommend /> /> path="daily" />
          <Route element=<Page element=<LikedSongs /> /> path="my/liked" />
          <Route element=<Page element=<RecentPlays /> /> path="my/recent" />
          <Route element=<Page element=<Settings /> /> path="settings" />
        </Route>
      </Routes>
      <PlayerPage />
      <LoginDialog />
      <Toaster
        position="top-right"
        richColors
        style={{
          top: "2.5rem",
        }}
      />
    </BrowserRouter>
  );
}

export default App;
