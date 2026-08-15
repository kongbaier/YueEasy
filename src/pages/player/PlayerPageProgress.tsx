import { SeekBar } from '@/modules/player/components';
import { FollowTooltip } from '@/modules/player/components/FollowTooltip';
import { useProgress } from '@/modules/player/hooks/useProgress';
import { usePlayer } from '@/modules/player/hooks/usePlayer';
import { formatDuration } from '@/shared/utils/format';
import { snapToDevicePixel } from '@/shared/utils/snap';
import { useDevicePixelRatio } from '@/shared/hooks/useDevicePixelRatio';

export const PlayerPageProgress = ({ className }: { className?: string }) => {
  const { percentage, formatted } = useProgress();
  const { seek, duration } = usePlayer();
  const dpr = useDevicePixelRatio();

  return (
    <div className={className}>
      <SeekBar
        barClassName="relative w-full h-1 rounded-full select-none"
        className="w-full h-4 cursor-pointer flex items-center"
        duration={duration}
        onSeek={seek}
        percentage={percentage}
      >
        {({
          displayPercentage,
          barRef,
          barWidth,
          isHovering,
          hoverBarX,
          hoverPercentage,
        }) => {
          const snappedX = snapToDevicePixel(
            (displayPercentage / 100) * barWidth,
            dpr,
          );

          const hoverTime =
            hoverPercentage !== null && duration > 0
              ? (hoverPercentage / 100) * duration
              : 0;

          return (
            <>
              <div
                className="absolute inset-0 rounded-full"
                style={{
                  background: `linear-gradient(to right, var(--color-primary) 0px, var(--color-primary) ${snappedX}px, var(--color-secondary) ${snappedX}px, var(--color-secondary) 100%)`,
                }}
              />
              <div
                className="absolute top-1/2 rounded-full -translate-y-1/2 -translate-x-1/2 w-3 h-3 bg-primary"
                style={{ left: `${snappedX}px` }}
              />
              <FollowTooltip anchorRef={barRef} open={isHovering} x={hoverBarX}>
                <span className="inline-block min-w-[11ch] text-center">
                  <span className="text-primary">
                    {formatDuration(hoverTime)}
                  </span>
                  /{formatDuration(duration)}
                </span>
              </FollowTooltip>
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
