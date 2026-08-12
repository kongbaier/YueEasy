import { useEffect } from 'react';
import { useMediaControls } from './useMediaControls';
import { usePlayerStore } from '../stores/player';
import { useQueueStore } from '../stores/queue';

export const usePlayerKeyboard = () => {
  const { handlePlay, handlePause } = useMediaControls();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      const tagName = target.tagName;
      if (
        tagName === 'INPUT' ||
        tagName === 'TEXTAREA' ||
        tagName === 'SELECT' ||
        target.isContentEditable
      ) {
        return;
      }

      const playerState = usePlayerStore.getState();
      const queueState = useQueueStore.getState();

      if (e.code === 'Space') {
        e.preventDefault();
        if (playerState.playing) {
          handlePause();
        } else {
          void handlePlay();
        }
        return;
      }

      if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') {
        e.preventDefault();
        const { currentTime, duration } = playerState;
        if (duration <= 0) return;
        const step = e.code === 'ArrowRight' ? 5 : -5;
        playerState.seek(Math.max(0, Math.min(currentTime + step, duration)));
        return;
      }

      if (e.code === 'PageUp') {
        e.preventDefault();
        queueState.prev();
        return;
      }

      if (e.code === 'PageDown') {
        e.preventDefault();
        queueState.next();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    // handlePlay/handlePause 为 useCallback([]) 稳定引用，effect 仍只挂一次
  }, [handlePlay, handlePause]);
};
