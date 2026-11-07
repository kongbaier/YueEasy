import { useEffect } from 'react';
import type { RefObject } from 'react';
import { setDesktopLyricsHeight } from '@/tauri/desktopLyrics';

interface UseDesktopLyricsAutoHeightOptions {
  /** 歌词块（上一句 / 当前句 / 翻译 / 下一句） */
  contentRef: RefObject<HTMLElement | null>;
  /** 顶部功能栏（含设置面板）：在流里占位，所以它的高度也要算进去 */
  chromeRef: RefObject<HTMLElement | null>;
}

/**
 * 桌面歌词窗口的高度由这个窗口自己决定（ViewModel）。
 *
 * 透明窗口的高度就是「挡桌面的面积」：不能让内容躲在早已写死的大框里（多出来的空区
 * 既挡桌面点击，也会在大字号时把上下一句挤出可视区）。所以布局多少高，窗口就多少高：
 * `height = 功能栏高度 + 歌词块高度`。
 *
 * **宽度不在这里**：宽度由 `tauri.conf.json` 的 `width` / `maxWidth` 定死（歌词区域的上限也在那里），
 * Web 侧不按窗口宽度排版、也不反推窗口宽度 —— 高度只数行数，与宽度无关。
 *
 * **高度不会随歌词跳**：每一行都是一行高的槽位（`nowrap`，缺上一句 / 下一句时用 `\u00A0`
 * 占位不塌陷），于是高度只随设置（字号 / 上下一句 / 翻译）变，不随播放变；上报前还做去重。
 */
export function useDesktopLyricsAutoHeight({
  contentRef,
  chromeRef,
}: UseDesktopLyricsAutoHeightOptions) {
  useEffect(() => {
    const chrome = chromeRef.current;
    const content = contentRef.current;
    /** 上一次上报的高度：一样就不发 IPC（窗口也别动） */
    let reported = -1;

    const report = () => {
      const chromeHeight = chrome?.getBoundingClientRect().height ?? 0;
      const contentHeight = content?.getBoundingClientRect().height ?? 0;
      const height = Math.ceil(chromeHeight + contentHeight);
      if (height <= 0 || height === reported) return;

      reported = height;
      void setDesktopLyricsHeight(height).catch(() => {
        // 发失败就允许下次重报（比如窗口刚销毁 / 还没就绪）
        reported = -1;
      });
    };

    const observer = new ResizeObserver(report);
    if (chrome) observer.observe(chrome);
    if (content) observer.observe(content);

    report();

    return () => observer.disconnect();
  }, [chromeRef, contentRef]);
}
