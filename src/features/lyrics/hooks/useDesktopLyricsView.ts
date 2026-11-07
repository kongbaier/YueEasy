import { useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULTS_PLAYER } from '@/shared/constants/player';
import type {
  DesktopLyricsPlayback,
  DesktopLyricsSnapshot,
} from '@/shared/types/desktopLyrics';
import type { DesktopLyricsSettings } from '@/shared/types/settings';
import {
  emitDesktopLyricsRequest,
  onDesktopLyricsPlayback,
  onDesktopLyricsReveal,
  onDesktopLyricsSnapshot,
  onDesktopLyricsState,
} from '@/tauri/desktopLyrics';
import { computeActiveLine } from '../active-line';
import { computeScrollTargetLine } from '../scroll-target';

const EMPTY_SNAPSHOT: DesktopLyricsSnapshot = {
  trackId: null,
  title: '',
  artist: '',
  lines: [],
  translations: [],
};

/** 进度锚点：收到播放进度的那一刻记下「本地时钟 + 该时刻的进度」，之后本地插值。 */
interface Anchor {
  positionMs: number;
  playing: boolean;
  /** 收到事件时的 `performance.now()`（同文档单调时钟；跨窗口不必可比，只需本地差分） */
  at: number;
}

/**
 * 桌面歌词窗口的 ViewModel。
 *
 * 播放进度只收 4Hz 的锚点，插值到 60fps 在本地做（rAF）：逐字歌词的填充需要每帧刷新，
 * 而每帧走一次 IPC 会把主窗口的渲染也拖下水。
 *
 * 本窗口不持可写状态：锁定 / 排版都以主窗口推来的 `settings` 为准（settings 唯一真相在主窗口）。
 */
export function useDesktopLyricsView() {
  const [snapshot, setSnapshot] = useState(EMPTY_SNAPSHOT);
  const [settings, setSettings] = useState<DesktopLyricsSettings>(
    DEFAULTS_PLAYER.desktopLyrics,
  );
  /** 锁定态下 Rust 观测到的「悬停够久」揭示态（此时窗口才可点）。 */
  const [revealed, setRevealed] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [hasTrack, setHasTrack] = useState(false);
  const [positionMs, setPositionMs] = useState(0);
  const anchorRef = useRef<Anchor>({ positionMs: 0, playing: false, at: 0 });

  useEffect(() => {
    let disposed = false;
    const unlisteners: Array<() => void> = [];

    const applyPlayback = (payload: DesktopLyricsPlayback) => {
      anchorRef.current = {
        positionMs: payload.positionMs,
        playing: payload.playing,
        at: performance.now(),
      };
      setPositionMs(payload.positionMs);
      setPlaying(payload.playing);
      setHasTrack(payload.hasTrack);
    };

    const bind = async () => {
      const bound = await Promise.all([
        onDesktopLyricsSnapshot(setSnapshot),
        onDesktopLyricsPlayback(applyPlayback),
        onDesktopLyricsState((payload) => {
          setSettings(payload.settings);
        }),
        onDesktopLyricsReveal((payload) => setRevealed(payload.revealed)),
      ]);
      if (disposed) {
        bound.forEach((unlisten) => unlisten());
        return;
      }
      unlisteners.push(...bound);
      // 窗口可能在主窗口推送之后才挂载（首次开启 / 重开）：主动要一次全量
      void emitDesktopLyricsRequest({ action: 'sync' });
    };

    void bind();

    return () => {
      disposed = true;
      unlisteners.forEach((unlisten) => unlisten());
    };
  }, []);

  // 播放中才需要每帧插值；暂停时进度是静止的，rAF 直接停掉
  useEffect(() => {
    if (!playing) return;

    let rafId = 0;
    const tick = () => {
      const anchor = anchorRef.current;
      setPositionMs(anchor.positionMs + (performance.now() - anchor.at));
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(rafId);
  }, [playing]);

  const lines = snapshot.lines;
  const translations = snapshot.translations;

  // 整首有没有翻译：`translations` 与 `lines` 按下标对齐，没翻译时是等长的空串数组，
  // 所以「数组非空」不代表有翻译。翻译行只在真的有翻译时才占位
  // （否则默认永远挂一行空占位，看着像凭空多出一行）。
  const hasTranslation = useMemo(
    () => translations.some((text) => text.trim().length > 0),
    [translations],
  );

  const activeLine = useMemo(
    () => computeActiveLine(positionMs / 1000, lines),
    [positionMs, lines],
  );

  // 空行（间奏）不显示：沿用歌词页的「播放行 → 展示行」换算
  const displayLine = useMemo(
    () => computeScrollTargetLine(activeLine, lines),
    [activeLine, lines],
  );

  return {
    lines,
    translations,
    hasTranslation,
    displayLine,
    positionMs,
    playing,
    hasTrack,
    settings,
    locked: settings.locked,
    revealed,
    hasLyrics: lines.length > 0,
  };
}
