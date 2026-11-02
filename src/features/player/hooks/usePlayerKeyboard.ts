import { useEffect } from 'react';
import { isNativeKeyboardZone, isTypingTarget } from '@/shared/lib/focus';
import { useMediaControls } from './useMediaControls';
import { usePlayerStore } from '@/features/player/stores/playerStore';
import { playerService } from '@/features/player/services/PlayerService';

/**
 * 全局播放器快捷键。
 *
 * 分组两处监听，是因为优先级不同：
 *
 * - **空格**：在 `window` **捕获阶段**拦截并 `stopPropagation`。
 *   空格是播放/暂停热键，必须压过「焦点控件的默认激活」：
 *   否则原生 `<button>` 会在 keyup 补一次 click、组件自己的 `onKeyDown(' ')`
 *   也会跑，表现为「按空格既切播放又误触控件」。
 *   输入框与 base-ui 浮层（菜单/下拉/对话框）里空格仍归控件本身。
 * - **方向键 / PageUp / PageDown**：留在冒泡阶段，先让区域焦点导航
 *   （`shared/lib/focus`，document 捕获阶段）处理「区域内移动焦点」；
 *   焦点导航没消费（走到区域边界）时按键才冒到这里做快退/快进/切歌。
 */
export const usePlayerKeyboard = () => {
  const { handlePlay, handlePause } = useMediaControls();

  useEffect(() => {
    const handleSpace = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || e.repeat) return;
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      if (isTypingTarget(e.target as Element | null)) return;
      if (isNativeKeyboardZone(e.target as Element | null)) return;

      e.preventDefault();
      e.stopPropagation();
      if (usePlayerStore.getState().playing) {
        handlePause();
      } else {
        void handlePlay();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (isTypingTarget(target) || isNativeKeyboardZone(target)) return;

      const playerState = usePlayerStore.getState();

      if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') {
        e.preventDefault();
        const { currentTime, duration } = playerState;
        if (duration <= 0) return;
        const step = e.code === 'ArrowRight' ? 5 : -5;
        playerService.seek(Math.max(0, Math.min(currentTime + step, duration)));
        return;
      }

      if (e.code === 'PageUp') {
        e.preventDefault();
        void playerService.prev();
        return;
      }

      if (e.code === 'PageDown') {
        e.preventDefault();
        void playerService.next();
      }
    };

    window.addEventListener('keydown', handleSpace, true);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleSpace, true);
      window.removeEventListener('keydown', handleKeyDown);
    };
    // handlePlay/handlePause 为 useCallback([]) 稳定引用，effect 仍只挂一次
  }, [handlePlay, handlePause]);
};
