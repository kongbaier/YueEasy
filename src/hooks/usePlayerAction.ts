import { useShallow } from "zustand/shallow";
import { usePlayerStore } from "@/stores";

export function usePlayerAction() {
  const { next, pause, resume, prev, playing } = usePlayerStore(
    useShallow((state) => ({
      pause: state.pause,
      resume: state.resume,
      next: state.next,
      prev: state.prev,
      playing: state.playing,
    })),
  );

  const handlePlay = () => {
    if (playing) {
      pause();
    } else {
      resume();
    }
  };

  return { isPlaying: playing, handlePlay, handleNext: next, handlePrev: prev };
}
