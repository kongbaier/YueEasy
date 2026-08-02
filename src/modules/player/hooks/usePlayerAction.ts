import { useShallow } from 'zustand/shallow';
import { usePlayerStore } from '../stores/player';
import { useQueueStore } from '../stores/queue';

export const usePlayerAction = () => {
  const { pause, resume, playing, isLoading } = usePlayerStore(
    useShallow((state) => ({
      pause: state.pause,
      resume: state.resume,
      playing: state.playing,
      isLoading: state.loading,
    })),
  );
  const { next, prev } = useQueueStore(
    useShallow((state) => ({
      next: state.next,
      prev: state.prev,
    })),
  );

  const handlePlay = () => {
    if (isLoading) return;
    if (playing) {
      pause();
    } else {
      resume();
    }
  };

  return {
    isPlaying: playing,
    isLoading,
    handlePlay,
    handleNext: next,
    handlePrev: prev,
  };
};
