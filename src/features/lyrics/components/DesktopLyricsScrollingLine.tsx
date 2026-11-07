import { clamp01 } from '@/shared/utils/number';
import { useOverflowDistance } from '../hooks/useOverflowDistance';

interface DesktopLyricsScrollingLineProps {
  /** 重新测量的键：换句 / 改字号都会变（同一行的文字内容不会变） */
  measureKey: string;
  /** 这一句的播放进度（0..1，超出范围会被夹住） */
  progress: number;
  children: React.ReactNode;
}

/**
 * 当前句的横向滚动视口（跑马灯）。
 *
 * 视口宽度 = 歌词区域宽度（窗口宽度减两侧内边距），**不是内容宽度** ——
 * 宽度上限在 `tauri.conf.json`（`width` = `maxWidth`）。
 *
 * 滚动位置**与播放进度对齐**，不是按固定速度自己跑：
 * `offset = 溢出距离 × 这一句的进度` —— 唱到哪就滚到哪，暂停就停在原地，拖动进度条也跟着走。
 * 两者都是逐字（yrc）与普通（lrc）歌词共用的同一套映射（lrc 没有字级时间，用整句进度）。
 *
 * 装得下（溢出距离 0）就完全静态：不挂 transform、不写 will-change 之外的东西。
 *
 * 纵向 `py-1` 是给文字的 drop-shadow 留的余量（`overflow-hidden` 会把投影一起裁掉），
 * 行高由内层的 `lineHeight` 决定，所以这一行仍然只有一行高。
 */
export const DesktopLyricsScrollingLine = ({
  measureKey,
  progress,
  children,
}: DesktopLyricsScrollingLineProps) => {
  const { viewportRef, contentRef, overflowPx } = useOverflowDistance(measureKey);
  const offset = overflowPx * clamp01(progress);

  return (
    <div className="w-full overflow-hidden py-1" ref={viewportRef}>
      {/* 文字按内容宽排（不被视口挤成换行），装得下时 `mx-auto` 居中；
          装不下时从左边缘开始，随进度整体左移 */}
      <div
        className="mx-auto w-max"
        ref={contentRef}
        style={
          overflowPx > 0
            ? {
                transform: `translateX(${-offset}px)`,
                willChange: 'transform',
              }
            : undefined
        }
      >
        {children}
      </div>
    </div>
  );
};
