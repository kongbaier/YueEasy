import { BrowserRouter, Route, Routes } from "react-router-dom";
import { LoginDialog } from "./components/LoginDialog";
import { MainLayout } from "./components/layout/MainLayout";
import { useAuthRestore } from "./hooks/useAuthRestore";
import { useMediaSession } from "./hooks/useMediaSession";
import { usePlayerKeyboard } from "./hooks/usePlayerKeyboard";
import { DailyRecommend } from "./pages/DailyRecommend";
import { Home } from "./pages/Home";
import { PlayerPage } from "./pages/PlayerPage";
import { Playlist } from "./pages/Playlist";
import { Search } from "./pages/Search";
import { Settings } from "./pages/Settings";
import "./index.css";

function App() {
  useAuthRestore();
  usePlayerKeyboard();
  useMediaSession();

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
      </Routes>
      <PlayerPage />
      <LoginDialog />
    </BrowserRouter>
  );
}

export default App;
