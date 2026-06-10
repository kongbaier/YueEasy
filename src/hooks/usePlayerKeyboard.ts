import { useEffect } from "react";
import { usePlayerStore } from "@/stores";

export const usePlayerKeyboard = () => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      const tagName = target.tagName;
      if (
        tagName === "INPUT" ||
        tagName === "TEXTAREA" ||
        tagName === "SELECT" ||
        target.isContentEditable
      ) {
        return;
      }

      const state = usePlayerStore.getState();

      if (e.code === "Space") {
        e.preventDefault();
        if (state.playing) {
          state.pause();
        } else {
          state.resume();
        }
        return;
      }

      if (e.code === "ArrowLeft" || e.code === "ArrowRight") {
        e.preventDefault();
        const { currentTime, duration } = state;
        if (duration <= 0) return;
        const step = e.code === "ArrowRight" ? 5 : -5;
        state.seek(Math.max(0, Math.min(currentTime + step, duration)));
        return;
      }

      if (e.code === "PageUp") {
        e.preventDefault();
        state.prev();
        return;
      }

      if (e.code === "PageDown") {
        e.preventDefault();
        state.next();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);
};
