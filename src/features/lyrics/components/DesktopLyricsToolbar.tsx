import { Lock, Pause, Play, SkipBack, SkipForward, SlidersHorizontal, X } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { cn } from '@/shared/utils/cn';

/** 工具栏按钮统一样式：浮在半透明遮罩上，靠白色明度表达层级。 */
const TOOLBAR_BUTTON =
  'text-white/80 hover:bg-white/15 hover:text-white aria-expanded:bg-white/15';

const DIVIDER = <span className="mx-0.5 h-5 w-px shrink-0 bg-white/20" />;

interface DesktopLyricsToolbarProps {
  /** 锁定态：只留一个「解锁」入口（此时窗口刚被 Rust 临时放开鼠标事件）。 */
  locked: boolean;
  playing: boolean;
  hasTrack: boolean;
  settingsOpen: boolean;
  onPrev: () => void;
  onNext: () => void;
  onTogglePlay: () => void;
  onToggleSettings: () => void;
  onLock: () => void;
  onClose: () => void;
}

/**
 * 顶部居中功能栏。
 *
 * 解锁态：播放控制 + 设置 / 锁定 / 关闭，直接浮在遮罩上（工具栏自身不套背景）；
 * 锁定态：只有「解锁」——锁定后窗口整体鼠标穿透，只有悬停够久才浮出这一个按钮。
 */
export const DesktopLyricsToolbar = ({
  locked,
  playing,
  hasTrack,
  settingsOpen,
  onPrev,
  onNext,
  onTogglePlay,
  onToggleSettings,
  onLock,
  onClose,
}: DesktopLyricsToolbarProps) => {
  if (locked) {
    // 锁定态只浮一个图标（可操作态不展示任何背景）
    return (
      <div className="pointer-events-auto flex items-center">
        <Button
          aria-label="解锁桌面歌词"
          className="size-10 text-white/80 hover:bg-white/15 hover:text-white"
          onClick={onLock}
          size="icon-lg"
          variant="ghost"
        >
          <Lock className="size-5" />
        </Button>
      </div>
    );
  }

  return (
    <div className="pointer-events-auto flex items-center gap-1">
      <Button
        aria-label="上一首"
        className={TOOLBAR_BUTTON}
        disabled={!hasTrack}
        onClick={onPrev}
        size="icon-lg"
        variant="ghost"
      >
        <SkipBack className="size-5" />
      </Button>
      <Button
        aria-label={playing ? '暂停' : '播放'}
        className={TOOLBAR_BUTTON}
        disabled={!hasTrack}
        onClick={onTogglePlay}
        size="icon-lg"
        variant="ghost"
      >
        {playing ? <Pause className="size-5" /> : <Play className="size-5" />}
      </Button>
      <Button
        aria-label="下一首"
        className={TOOLBAR_BUTTON}
        disabled={!hasTrack}
        onClick={onNext}
        size="icon-lg"
        variant="ghost"
      >
        <SkipForward className="size-5" />
      </Button>

      {DIVIDER}

      <Button
        aria-expanded={settingsOpen}
        aria-label="桌面歌词设置"
        className={cn(TOOLBAR_BUTTON, settingsOpen && 'text-white')}
        onClick={onToggleSettings}
        size="icon-lg"
        variant="ghost"
      >
        <SlidersHorizontal className="size-5" />
      </Button>
      <Button
        aria-label="锁定桌面歌词"
        className={TOOLBAR_BUTTON}
        onClick={onLock}
        size="icon-lg"
        variant="ghost"
      >
        <Lock className="size-5" />
      </Button>
      <Button
        aria-label="关闭桌面歌词"
        className={TOOLBAR_BUTTON}
        onClick={onClose}
        size="icon-lg"
        variant="ghost"
      >
        <X className="size-5" />
      </Button>
    </div>
  );
};
