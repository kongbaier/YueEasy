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
/** `/player` 只做 URL / 返回键镜像：画面由布局层的播放页面板负责（见 playerPanelStore）。 */
const PlayerRoute = () => null;

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
          <Route element={<RecentPlays />} path="my/recent" />
          <Route element={<Cloud />} path="my/cloud" />
          {/* 我的主页：一级页，与 user/:id 共用 UserProfile 主体 */}
          <Route element={<MyHome />} path="my" />
          <Route element={<Settings />} path="settings" />
          {/* /player 只是 URL 镜像：面板挂在布局层，不参与 outlet 换页（否则两块板子
              不可能同时在文档里）。路由存在的意义是返回键 / 深链 / 焦点语义。 */}
          <Route element={<PlayerRoute />} path="player" />
        </Route>
      </Routes>
      <LoginModal />
    </BrowserRouter>
  );
}
