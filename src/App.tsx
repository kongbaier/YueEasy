import { QueryErrorResetBoundary } from "@tanstack/react-query";
import { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";
import { useAccentColor } from "@/hooks/useAccentColor";
import { useAuthRestore } from "@/hooks/useAuthRestore";
import { usePlayerRestore } from "@/hooks/usePlayerRestore";
import { useQueuePersistence } from "@/hooks/useQueuePersistence";
import { useThemeSync } from "@/hooks/useThemeSync";
import { useWindowEffect } from "@/hooks/useWindowEffect";
import { ErrorBoundary } from "./components/ErrorBoundary";
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

const PageFallback = () => {
  return (
    <div className="p-6 space-y-4">
      <Skeleton className="h-7 w-48 rounded" shimmer />
      <Skeleton className="h-40 w-full rounded-xl" shimmer />
      <Skeleton className="h-4 w-3/4 rounded" shimmer />
    </div>
  );
};

function App() {
  useAccentColor();
  useAuthRestore();
  usePlayerRestore();
  useQueuePersistence();
  useThemeSync();
  useWindowEffect();

  return (
    <BrowserRouter>
      <QueryErrorResetBoundary>
        <ErrorBoundary>
          <Suspense fallback={<PageFallback />}>
            <Routes>
              <Route element={<MainLayout />}>
                <Route element={<Home />} index />
                <Route element={<Search />} path="search" />
                <Route element={<Playlist />} path="playlist/:id" />
                <Route element={<DailyRecommend />} path="daily" />
                <Route element={<LikedSongs />} path="my/liked" />
                <Route element={<RecentPlays />} path="my/recent" />
                <Route element={<Settings />} path="settings" />
              </Route>
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </QueryErrorResetBoundary>
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
