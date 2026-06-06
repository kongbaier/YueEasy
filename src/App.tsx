import { lazy } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { MainLayout } from "./components/layout/MainLayout";
import { useAuthRestore } from "./hooks/useAuthRestore";
import { useLikeInit } from "./hooks/useLikeInit";
import { useMediaSession } from "./hooks/useMediaSession";
import { usePlayerKeyboard } from "./hooks/usePlayerKeyboard";
import { usePlayerRestore } from "./hooks/usePlayerRestore";
import { useQueuePersistence } from "./hooks/useQueuePersistence";
import "./styles/index.css";

const Home = lazy(() => import("./pages/Home"));
const Search = lazy(() => import("./pages/Search"));
const Playlist = lazy(() => import("./pages/Playlist"));
const DailyRecommend = lazy(() => import("./pages/DailyRecommend"));
const LikedSongs = lazy(() => import("./pages/LikedSongs"));
const RecentPlays = lazy(() => import("./pages/RecentPlays"));
const Settings = lazy(() => import("./pages/Settings"));
const PlayerPage = lazy(() => import("./pages/PlayerPage"));
const LoginDialog = lazy(() => import("./components/LoginDialog"));

function App() {
  useAuthRestore();
  usePlayerRestore();
  useQueuePersistence();
  usePlayerKeyboard();
  useMediaSession();
  useLikeInit();

  return (
    <BrowserRouter>
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
      <PlayerPage />
      <LoginDialog />
    </BrowserRouter>
  );
}

export default App;
