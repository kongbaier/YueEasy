import { useShallow } from "zustand/shallow";
import { usePlayerStore } from "@/stores";

export function usePlayerAction() {
  const { next, pause, resume, prev, playing, playerState } = usePlayerStore(
    useShallow((state) => ({
      pause: state.pause,
      resume: state.resume,
      next: state.next,
      prev: state.prev,
      playing: state.playing,
      playerState: state.playerState,
    })),
  );

  const isLoading = playerState === "loading";

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
