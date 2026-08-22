import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import { useDragScrub } from '@/modules/player/hooks/useDragScrub';

interface SeekBarContext {
  displayPercentage: number;
  barRef: React.RefObject<HTMLDivElement | null>;
  barWidth: number;
  isHovering: boolean;
  hoverBarX: number;
  hoverPercentage: number | null;
}

interface SeekBarProps {
  percentage: number;
  duration: number;
  onSeek: (time: number) => void;
  className?: string;
  barClassName?: string;
  children: (ctx: SeekBarContext) => ReactNode;
}

export const SeekBar = ({
  percentage,
  duration,
  onSeek,
  className,
  barClassName,
  children,
}: SeekBarProps) => {
  const barRef = useRef<HTMLDivElement>(null);
  const [barWidth, setBarWidth] = useState(0);
  const [scrubPercentage, setScrubPercentage] = useState<number | null>(null);
  const displayPercentage = scrubPercentage ?? percentage;

  const [hoverPercentage, setHoverPercentage] = useState<number | null>(null);
  const [hoverBarX, setHoverBarX] = useState(0);

  const handlePointerMove = (e: React.PointerEvent) => {
    const bar = barRef.current;
    if (!bar) return;
    const rect = bar.getBoundingClientRect();
    const x = e.clientX - rect.left;
    setHoverBarX(x);
    setHoverPercentage((x / rect.width) * 100);
  };

  const handlePointerLeave = () => {
    setHoverPercentage(null);
  };

  useEffect(() => {
    const bar = barRef.current;
    if (!bar) return;
    const observer = new ResizeObserver(([entry]) => {
      setBarWidth(entry.contentRect.width);
    });
    observer.observe(bar);
    return () => observer.disconnect();
  }, []);

  const handlePointerDown = useDragScrub(barRef, {
    onScrub: (ratio) => setScrubPercentage(ratio * 100),
    onCommit: (ratio) => {
      onSeek(ratio * duration);
      setScrubPercentage(null);
    },
  });

  return (
    <div
      className={className}
      onPointerDown={handlePointerDown}
      onPointerLeave={handlePointerLeave}
      onPointerMove={handlePointerMove}
    >
      <div
        className={barClassName}
        ref={barRef}
        style={{ touchAction: 'none' }}
      >
        {children({
          displayPercentage,
          barRef,
          barWidth,
          isHovering: hoverPercentage !== null,
          hoverBarX,
          hoverPercentage,
        })}
      </div>
    </div>
  );
};
