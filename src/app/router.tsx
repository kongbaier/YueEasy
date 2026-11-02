import { lazy } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AppLayout } from './layout';
import { LoginModal } from '@/features/auth/components/LoginModal';

const Home = lazy(() => import('@/features/home/HomePage'));
const Search = lazy(() => import('@/features/search/SearchPage'));
const Playlist = lazy(() => import('@/features/playlist/PlaylistPage'));
const Album = lazy(() => import('@/features/album/AlbumPage'));
const Artist = lazy(() => import('@/features/artist/ArtistPage'));
const UserProfile = lazy(() => import('@/features/user/UserPage'));
const MyHome = lazy(() => import('@/features/user/MyHomePage'));
const DailyRecommend = lazy(() => import('@/features/daily/DailyPage'));
const Liked = lazy(() => import('@/features/like/LikedPage'));
const RecentPlays = lazy(() => import('@/features/recent/RecentPage'));
const Cloud = lazy(() => import('@/features/cloud/CloudPage'));
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
          <Route element={<Artist />} path="artist/:id" />
          <Route element={<UserProfile />} path="user/:id" />
          <Route element={<Playlist />} path="playlist/:id" />
          <Route element={<DailyRecommend />} path="daily" />
          <Route element={<Liked />} path="my/liked" />
          {/* 守卫重定向后的落地路由，与 playlist/:id 共用 PlaylistPage */}
          <Route element={<Playlist />} path="my/liked/:id" />
          <Route element={<RecentPlays />} path="my/recent" />
          <Route element={<Cloud />} path="my/cloud" />
          {/* 我的主页：一级页，与 user/:id 共用 UserProfile 主体 */}
          <Route element={<MyHome />} path="my" />
          <Route element={<Settings />} path="settings" />
        </Route>
      </Routes>
      <PlayerPage />
      <LoginModal />
    </BrowserRouter>
  );
}
