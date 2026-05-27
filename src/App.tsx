import { BrowserRouter, Route, Routes } from "react-router-dom";
import { MainLayout } from "./components/layout/MainLayout";
import { useNcmHealth } from "./hooks/useNcmHealth";
import { usePlayer } from "./hooks/usePlayer";
import { DailyRecommend } from "./pages/DailyRecommend";
import { Home } from "./pages/Home";
import { Login } from "./pages/Login";
import { Playlist } from "./pages/Playlist";
import { Search } from "./pages/Search";
import { Settings } from "./pages/Settings";
import "./App.css";

function App() {
  usePlayer();
  useNcmHealth();

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<MainLayout />}>
          <Route element={<Home />} index />
          <Route element={<Search />} path="search" />
          <Route element={<Playlist />} path="playlist/:id" />
          <Route element={<DailyRecommend />} path="daily" />
          <Route element={<Settings />} path="settings" />
        </Route>
        <Route element={<Login />} path="login" />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
