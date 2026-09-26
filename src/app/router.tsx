import { lazy } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AppLayout } from './layout';
import { LoginModal } from '@/features/auth/components/LoginModal';

const Home = lazy(() => import('@/features/home/HomePage'));
const Search = lazy(() => import('@/features/search/SearchPage'));
const Playlist = lazy(() => import('@/features/playlist/PlaylistPage'));
const Album = lazy(() => import('@/features/album/AlbumPage'));
const DailyRecommend = lazy(() => import('@/features/daily/DailyPage'));
const Liked = lazy(() => import('@/features/like/LikedPage'));
const RecentPlays = lazy(() => import('@/features/recent/RecentPage'));
const MyPlaylists = lazy(
  () => import('@/features/my-playlists/MyPlaylistsPage'),
);
const Settings = lazy(() => import('@/features/settings/SettingsPage'));
const PlayerPage = lazy(() => import('@/features/player/PlayerPage'));

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route element={<Home />} index />
          <Route element={<Search />} path="search" />
          <Route element={<Album />} path="album/:id" />
          <Route element={<Playlist />} path="playlist/:id" />
          <Route element={<DailyRecommend />} path="daily" />
          <Route element={<Liked />} path="my/liked" />
          <Route element={<RecentPlays />} path="my/recent" />
          <Route element={<MyPlaylists />} path="my/playlists" />
          <Route element={<Settings />} path="settings" />
        </Route>
      </Routes>
      <PlayerPage />
      <LoginModal />
    </BrowserRouter>
  );
}
