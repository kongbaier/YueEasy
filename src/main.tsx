import React from 'react';
import ReactDOM from 'react-dom/client';
import { bootstrap } from '@/app/bootstrap';
import App from './app/App';

// 主窗口入口。桌面歌词窗口有独立入口（`desktop-lyrics.html` + `src/desktop-lyrics.tsx`），
// 两个窗口互不求值对方的模块图。

void bootstrap();

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
