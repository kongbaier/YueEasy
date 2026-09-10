import { lazy } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AppLayout } from './layout';
import { PlayerPageProvider } from '@/modules/player/contexts/PlayerPageContext';
import { LoginDialog } from '@/modules/auth/components/LoginDialog';

const Home = lazy(() => import('@/pages/home'));
const Search = lazy(() => import('@/pages/search'));
const Playlist = lazy(() => import('@/pages/playlist'));
const Album = lazy(() => import('@/pages/album'));
const DailyRecommend = lazy(() => import('@/pages/daily'));
const LikedSongs = lazy(() => import('@/pages/liked'));
const RecentPlays = lazy(() => import('@/pages/recent'));
const MyPlaylists = lazy(() => import('@/pages/my-playlists'));
const Settings = lazy(() => import('@/pages/settings'));
const PlayerPage = lazy(() => import('@/pages/player'));

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
            <Route element=<MyPlaylists /> path="my/playlists" />
            <Route element=<Settings /> path="settings" />
          </Route>
        </Routes>
        <PlayerPage />
        <LoginDialog />
      </PlayerPageProvider>
    </BrowserRouter>
  );
}
