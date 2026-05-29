import { useMemo } from "react";
import { useShallow } from "zustand/shallow";
import { formatDuration } from "@/lib/format";
import { usePlayerStore } from "@/stores";

export function useProgress() {
  const { currentTime, duration } = usePlayerStore(
    useShallow((state) => ({
      currentTime: state.currentTime,
      duration: state.duration,
    })),
  );

  const formattedTime = useMemo(
    () => formatDuration(currentTime),
    [currentTime],
  );
  const formattedDuration = useMemo(() => formatDuration(duration), [duration]);

  return {
    formatted: {
      currentTime: formattedTime,
      duration: formattedDuration,
    },
    percentage: duration > 0 ? (currentTime / duration) * 100 : 0,
  };
}
