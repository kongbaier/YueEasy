import { useEffect, useMemo } from "react";
import { useShallow } from "zustand/shallow";
import { formatDuration } from "@/shared/utils/format";
import { usePlayerStore } from "../stores/player";

export const useProgress = () => {
  const { currentTime, duration } = usePlayerStore(
    useShallow((state) => ({
      currentTime: state.currentTime,
      duration: state.duration,
    })),
  );

  useEffect(() => {
    console.log(currentTime, duration);
  }, [currentTime, duration]);

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
};
