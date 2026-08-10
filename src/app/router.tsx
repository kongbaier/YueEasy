import { lazy } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AppLayout } from "./layout";
import { PlayerPageProvider } from "@/modules/player/contexts/PlayerPageContext";
import { LoginDialog } from "@/modules/auth/LoginDialog";

const Home = lazy(() => import("@/pages/Home"));
const Search = lazy(() => import("@/modules/search"));
const Playlist = lazy(() => import("@/pages/Playlist"));
const Album = lazy(() => import("@/pages/Album"));
const DailyRecommend = lazy(() => import("@/pages/DailyRecommend"));
const LikedSongs = lazy(() => import("@/pages/LikedSongs"));
const RecentPlays = lazy(() => import("@/pages/RecentPlays"));
const Settings = lazy(() => import("@/pages/Settings"));
const PlayerPage = lazy(() => import("@/modules/player/pages/PlayerPage"));

export function AppRouter() {
  return (
    <BrowserRouter>
      <PlayerPageProvider>
        <Routes>
          <Route element=<AppLayout />>
            <Route element=<Home /> index />
            <Route element=<Search /> path="search" />
            <Route element=<Album /> path="album/:id" />
            <Route element=<Playlist /> path="playlist/:id" />
            <Route element=<DailyRecommend /> path="daily" />
            <Route element=<LikedSongs /> path="my/liked" />
            <Route element=<RecentPlays /> path="my/recent" />
            <Route element=<Settings /> path="settings" />
          </Route>
        </Routes>
        <PlayerPage />
        <LoginDialog />
      </PlayerPageProvider>
    </BrowserRouter>
  );
}
