// 桌面歌词窗口的入口（对应 `desktop-lyrics.html`，由 tauri.conf.json 的第二个窗口加载）。
//
// 独立入口 = 独立产物：这个窗口**不会**求值主窗口的模块图（App / 路由 / 播放器 / 音频引擎），
// 反过来主窗口的入口也不会碰歌词浮层。窗口身份由「加载哪个 html」决定，不靠运行时判断。
//
// 分层同主入口：这里只做「挂载 + 平台级接线」，窗口内容属于 features/lyrics。

import React from 'react';
import ReactDOM from 'react-dom/client';
import { DesktopLyricsWindow } from '@/features/lyrics/components/DesktopLyricsWindow';
import { emitDesktopLyricsRequest } from '@/tauri/desktopLyrics';

/**
 * 未捕获错误转回主窗口控制台：副窗口没有菜单、也没有可达的 devtools，
 * 不然渲染 / 订阅出错时只能表现为「窗口空着」。
 */
function forwardWindowErrors() {
  const forward = (message: string) => {
    void emitDesktopLyricsRequest({ action: 'log', message });
  };

  window.addEventListener('error', (event) => {
    forward(`${event.message} @ ${event.filename}:${event.lineno}`);
  });
  window.addEventListener('unhandledrejection', (event) => {
    forward(`unhandled rejection: ${String(event.reason)}`);
  });
}

forwardWindowErrors();

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <DesktopLyricsWindow />
  </React.StrictMode>,
);
