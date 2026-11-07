import { useCallback, useEffect, useRef, useState } from 'react';
import { useAccentColor } from '@/shared/hooks/useAccentColor';
import { useWindowDrag } from '@/shared/hooks/useWindowDrag';
import type { DesktopLyricsLayoutPatch } from '@/shared/types/desktopLyrics';
import { cn } from '@/shared/utils/cn';
import { clamp01 } from '@/shared/utils/number';
import { emitDesktopLyricsRequest } from '@/tauri/desktopLyrics';
import {
  CHROME_HIDE_DELAY_MS,
  CHROME_SHOW_DELAY_MS,
  LEAVE_MOVE_WINDOW_MS,
  LYRIC_LINE_HEIGHT,
  LYRICS_COLOR,
  SIDE_LINE_SCALE,
  TRANSLATION_SCALE,
  sideLineColor,
} from '../constants';
import { useDesktopLyricsAutoHeight } from '../hooks/useDesktopLyricsAutoHeight';
import { useDesktopLyricsView } from '../hooks/useDesktopLyricsView';
import { DesktopLyricText } from './DesktopLyricText';
import { DesktopLyricsScrollingLine } from './DesktopLyricsScrollingLine';
import { DesktopLyricsSettingsPanel } from './DesktopLyricsSettingsPanel';
import { DesktopLyricsToolbar } from './DesktopLyricsToolbar';
import '@/assets/css/index.css';

/** 整窗拖拽热区（属性名与 useWindowDrag 的入参对应） */
const DRAG_ATTR = 'desktop-lyrics-drag';

/** 空行占位符：空 `<p>` 没有行盒（高度 0），开头没上一句 / 结尾没下一句时槽位就会塔陷，
 *  窗口高度随之变矮 —— 填个不断行空格，行高与真实文本完全一致。 */
const EMPTY_LINE_PLACEHOLDER = '\u00A0';

/**
 * 桌面歌词窗口的根组件（独立 WebView 窗口，不是路由页）。
 *
 * 交互模型（两种状态）：
 * - **解锁**：窗口可拖动、可点。鼠标进入 → 短延迟后把窗口底色染深并浮出顶部功能栏，
 *   **鼠标停在里面就一直保持**，移出窗口才收起；
 * - **锁定**：窗口鼠标穿透、不可拖动，本窗口收不到 hover —— 由 Rust 观测光标，
 *   悬停够久才临时放开穿透并浮出「解锁」入口（不染底色）。
 */
export const DesktopLyricsWindow = () => {
  const {
    lines,
    translations,
    hasTranslation,
    displayLine,
    positionMs,
    playing,
    hasTrack,
    settings,
    locked,
    revealed,
    hasLyrics,
  } = useDesktopLyricsView();

  useAccentColor();
  // 双击最大化对这个窗口没有意义（`maximizable: false`，且 capability 里没给权限），
  // 传 doubleClick:false 免得双击后留下一个被拒绝的 promise。
  useWindowDrag(DRAG_ATTR, { disabled: locked, doubleClick: false });
  const chrome = useSessionChrome({ locked, revealed });

  const currentLine = lines[displayLine];
  const translation = translations[displayLine];
  const currentPosition = displayLine === -1 ? null : positionMs;
  // 这一句唱到哪（0..1）：既用来驱动横向滚动位置，也是「逐字 / 普通歌词」共用的进度
  const currentProgress =
    currentPosition === null || !currentLine || currentLine.durationMs <= 0
      ? 0
      : clamp01((currentPosition - currentLine.startMs) / currentLine.durationMs);

  // 窗口高度跟着内容走（宽度由 tauri.conf.json 定死，见 useDesktopLyricsAutoHeight）
  const contentRef = useRef<HTMLDivElement | null>(null);
  const chromeRef = useRef<HTMLDivElement | null>(null);
  useDesktopLyricsAutoHeight({ contentRef, chromeRef });

  // 每一行都是**一行**（nowrap，不换行）：默认是「上一句 / 当前句 / 下一句」三行，
  // 整首有翻译时再多一行（没翻译的曲目不占位，不让一行空占位凭空多出来）：
  //   - 空行用 nbsp 占位，缺上一句 / 下一句时不塔陷 → 高度不随播放跳；
  //   - 当前句不换行 → 装不下就交给 `DesktopLyricsScrollingLine` 在视口内横向滚动
  //     （不换行、不截断），上下一句 / 翻译超出则省略号。
  const sideStyle = {
    fontSize: Math.round(settings.fontSize * SIDE_LINE_SCALE),
    lineHeight: LYRIC_LINE_HEIGHT,
    color: sideLineColor(settings.sideLineOpacity),
    // 普通文本用 text-shadow：比 drop-shadow 便宜，也不会多出一块渲染面
    textShadow: LYRICS_COLOR.textShadow,
  };

  return (
    <div
      // 根节点**不**承担全窗背景 / 颜色过渡 / 圆角裁剪：
      // 透明窗口里，`background-color` 动画会让 Chromium 在过渡前后提升 / 降级合成层，
      // 表现为「整页忽然变淡」。底色因此是下面那层纯黑 + opacity（纯合成器操作）。
      className={cn(
        // `items-center`：让两个子块都保持**内容宽**（stretch 会把它们拉成窗口宽，
        // 而窗口宽又由内容宽决定 —— 宽度就再也缩不回来了）
        'relative flex h-screen w-screen flex-col items-center overflow-hidden ',
        chrome.dimmed ? 'bg-black/45' : 'bg-transparent',
      )}
      {...{ [`data-${DRAG_ATTR}`]: '' }}
      onMouseEnter={chrome.handleMouseEnter}
      onMouseLeave={chrome.handleMouseLeave}
      onMouseMove={chrome.handleMouseMove}
    >
      {/* 顶部居中功能栏（+ 设置在它下方展开）：**在流里占位**，不显形时也不让歌词顶上来 ——
          悬浮盖在歌词上会盖掉上一句；收起时再让歌词跳一下更糟。
          （不显形时仍在 DOM 里，靠 `opacity-0` 淡出，高度照样算进窗口高度） */}
      <div
        className={cn(
          'flex flex-col items-center gap-2 py-1.5',
          chrome.chromeVisible
            ? 'opacity-100'
            : 'pointer-events-none opacity-0',
        )}
        ref={chromeRef}
      >
        <DesktopLyricsToolbar
          hasTrack={hasTrack}
          locked={locked}
          onClose={() => void emitDesktopLyricsRequest({ action: 'close' })}
          onLock={() => {
            // 解锁后立刻把完整功能栏点出来（此时鼠标就在窗口上，不该让用户再晃一下）
            if (locked) chrome.armNow();
            void emitDesktopLyricsRequest({
              action: locked ? 'unlock' : 'lock',
            });
          }}
          onNext={() => void emitDesktopLyricsRequest({ action: 'next' })}
          onPrev={() => void emitDesktopLyricsRequest({ action: 'prev' })}
          onTogglePlay={() =>
            void emitDesktopLyricsRequest({ action: 'toggle-play' })
          }
          onToggleSettings={chrome.toggleSettings}
          playing={playing}
          settingsOpen={chrome.settingsOpen}
        />

        {chrome.settingsOpen && !locked && (
          <DesktopLyricsSettingsPanel
            onChange={(patch: DesktopLyricsLayoutPatch) =>
              void emitDesktopLyricsRequest({ action: 'update-layout', patch })
            }
            settings={settings}
          />
        )}
      </div>

      {/* 整窗不挂 filter：drop-shadow 会多出一块全屏渲染面。投影挂在各自的文字上
          （逐字歌词的渐变字用 drop-shadow，见 DesktopLyricText；其余用 text-shadow）。
          宽度就用窗口宽度（**按窗口宽度排版**，上限在 tauri.conf.json），
          这里只负责把行叠出来、让窗口高度贴合它。 */}
      <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-center px-8 py-2">
        <div
          className="flex w-full flex-col items-center gap-1.5 text-center"
          ref={contentRef}
        >
          {hasLyrics && currentLine ? (
            <>
              {settings.sideLineOpacity > 0 && (
                <p className="max-w-full truncate" style={sideStyle}>
                  {lines[displayLine - 1]?.text || EMPTY_LINE_PLACEHOLDER}
                </p>
              )}
              <DesktopLyricsScrollingLine
                measureKey={`${currentLine.startMs}-${currentLine.text.length}-${settings.fontSize}`}
                progress={currentProgress}
              >
                <DesktopLyricText
                  className="whitespace-nowrap"
                  line={currentLine}
                  positionMs={currentPosition}
                  style={{
                    fontSize: settings.fontSize,
                    lineHeight: LYRIC_LINE_HEIGHT,
                    letterSpacing: '0.01em',
                  }}
                />
              </DesktopLyricsScrollingLine>
              {settings.showTranslation && hasTranslation && (
                <p
                  className="max-w-full truncate text-white/60"
                  style={{
                    fontSize: Math.round(settings.fontSize * TRANSLATION_SCALE),
                    lineHeight: LYRIC_LINE_HEIGHT,
                    textShadow: LYRICS_COLOR.textShadow,
                  }}
                >
                  {translation || EMPTY_LINE_PLACEHOLDER}
                </p>
              )}
              {settings.sideLineOpacity > 0 && (
                <p className="max-w-full truncate" style={sideStyle}>
                  {lines[displayLine + 1]?.text || EMPTY_LINE_PLACEHOLDER}
                </p>
              )}
            </>
          ) : (
            <p
              className="text-sm text-white/45"
              style={{ textShadow: LYRICS_COLOR.textShadow }}
            >
              暂无歌词
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

/** 清掉一个 timer ref（模块级纯函数：useCallback 里用不会引入额外依赖）。 */
function clearTimer(timer: { current: number | null }) {
  if (timer.current !== null) window.clearTimeout(timer.current);
  timer.current = null;
}

/**
 * 窗口「可操作」状态机。
 *
 * 显隐只由「鼠标是否在窗口内」决定：**鼠标停在里面就一直保持底色 + 功能栏**，移出才收起。
 *
 * 两个防抖点（都是为了让「还在窗口里」不被误判成离开）：
 *   - **忽略伪 mouseleave**：歌词换行 / 字级 span 重建会把光标下的元素移除，Chromium 随即补发一次
 *     `mouseout`（relatedTarget 为 null）。判据是「最后 200ms 内有没有真实 mousemove」——
 *     指针不移动是不可能移出窗口的，而伪事件的坐标不可靠（可能是 (0,0) / 陈旧值），不能拿坐标判；
 *   - **收起延迟** `CHROME_HIDE_DELAY_MS`：真离开也延迟收起，期间任何真实 mousemove / mouseenter 都能撤销。
 *
 * 锁定态由 Rust 主导（窗口穿透、收不到 hover），这里只消费它推来的 `revealed`。
 */
function useSessionChrome({
  locked,
  revealed,
}: {
  locked: boolean;
  revealed: boolean;
}) {
  /** 解锁态下「功能栏 + 底色」是否显形（进入时有短延迟，避免划过就闪） */
  const [armed, setArmed] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const showTimer = useRef<number | null>(null);
  const hideTimer = useRef<number | null>(null);

  /** 请求显形（并撤销待执行的收起） */
  const requestChrome = useCallback(() => {
    clearTimer(hideTimer);
    if (showTimer.current !== null) return;
    showTimer.current = window.setTimeout(() => {
      showTimer.current = null;
      setArmed(true);
    }, CHROME_SHOW_DELAY_MS);
  }, []);

  /** 立即显形（明确的点击意图，比如刚点了解锁按钮） */
  const armNow = useCallback(() => {
    clearTimer(showTimer);
    clearTimer(hideTimer);
    setArmed(true);
  }, []);

  /** 最后一次**真实** mousemove 的时间戳（伪 leave 不带移动，用它区分真假离开） */
  const lastMoveAt = useRef(0);

  /** 开发期自检计数：真离开 / 被忽略的伪 leave */
  const [leaveStats, setLeaveStats] = useState({ real: 0, ignored: 0 });

  const handleMouseMove = useCallback(() => {
    lastMoveAt.current = performance.now();
    requestChrome();
  }, [requestChrome]);

  const handleMouseLeave = useCallback(() => {
    // 真实移出窗口必须伴随移动（mousemove 一定在 leave 之前）；
    // 指针静止时收到 leave，只可能是歌词换行 / 字级 span 重建把光标下的元素移除后
    // Chromium 补发的伪事件 —— 忽略，否则底色和功能栏会莫名淡出。
    const sinceMove = performance.now() - lastMoveAt.current;
    if (sinceMove > LEAVE_MOVE_WINDOW_MS) {
      setLeaveStats((s) => ({ ...s, ignored: s.ignored + 1 }));
      return;
    }

    setLeaveStats((s) => ({ ...s, real: s.real + 1 }));
    clearTimer(showTimer);
    clearTimer(hideTimer);
    hideTimer.current = window.setTimeout(() => {
      hideTimer.current = null;
      setArmed(false);
      setSettingsOpen(false);
    }, CHROME_HIDE_DELAY_MS);
  }, []);

  const toggleSettings = useCallback(() => {
    setSettingsOpen((open) => !open);
  }, []);

  // 进入锁定态：窗口收不到 hover 了，hover 派生的显形状态清零，
  // 免得「从主窗口解锁时鼠标其实不在歌词上」却把功能栏画出来。
  // （锁定态的显隐完全由 Rust 的 revealed 决定）
  useEffect(() => {
    if (!locked) return;
    const id = window.setTimeout(() => setArmed(false), 0);
    return () => window.clearTimeout(id);
  }, [locked]);

  useEffect(
    () => () => {
      clearTimer(showTimer);
      clearTimer(hideTimer);
    },
    [],
  );

  const chromeVisible = locked ? revealed : armed;

  return {
    chromeVisible,
    /** 窗口底色染深（锁定态不染色） */
    dimmed: !locked && armed,
    settingsOpen: settingsOpen && chromeVisible && !locked,
    toggleSettings,
    armNow,
    handleMouseEnter: requestChrome,
    handleMouseMove,
    handleMouseLeave,
    /** 开发期自检数据（`import.meta.env.DEV` 时才渲染） */
    debug: { armed, locked, revealed, ...leaveStats },
  };
}
