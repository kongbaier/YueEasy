import { useShallow } from "zustand/shallow";
import { usePlayerStore } from "@/stores";

export function usePlayerAction() {
  const { next, pause, resume, prev, playing, core } = usePlayerStore(
    useShallow((state) => ({
      pause: state.pause,
      resume: state.resume,
      next: state.next,
      prev: state.prev,
      playing: state.playing,
      core: state.core,
    })),
  );

  const isLoading = core.state === "loading";

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
}
