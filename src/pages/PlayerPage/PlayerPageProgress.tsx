import { SeekBar } from "@/components/player";
import { useProgress } from "@/hooks/useProgress";
import { usePlayerStore } from "@/stores";

export const PlayerPageProgress = ({ className }: { className?: string }) => {
  const { percentage, formatted } = useProgress();
  const seek = usePlayerStore((s) => s.seek);
  const duration = usePlayerStore((s) => s.duration);

  return (
    <div className={className}>
      <SeekBar
        barClassName="relative w-full h-1 rounded-full select-none"
        className="w-full h-4 cursor-pointer flex items-center"
        duration={duration}
        onSeek={seek}
        percentage={percentage}
      >
        {({ displayPercentage, barWidth }) => {
          const rawX = (displayPercentage / 100) * barWidth;
          const dpr = window.devicePixelRatio || 1;
          const snappedX = Math.round(rawX * dpr) / dpr;

          return (
            <>
              <div
                className="absolute inset-0 rounded-full"
                style={{
                  background: `linear-gradient(to right, var(--color-primary) 0%, var(--color-primary) ${displayPercentage}%, var(--color-secondary) ${displayPercentage}%, var(--color-secondary) 100%)`,
                }}
              />
              <div
                className="absolute top-1/2 rounded-full -translate-y-1/2 -translate-x-1/2 w-3 h-3 bg-primary"
                style={{ left: `${snappedX}px` }}
              />
            </>
          );
        }}
      </SeekBar>

      <div className="flex justify-between text-xs text-muted-foreground tabular-nums mt-1">
        <span>{formatted.currentTime}</span>
        <span>{formatted.duration}</span>
      </div>
    </div>
  );
};
