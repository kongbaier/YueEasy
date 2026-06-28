import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";

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
  const scrubRatioRef = useRef(0);
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

  const handlePointerDown = (e: React.PointerEvent) => {
    const bar = barRef.current;
    if (!bar) return;
    const rect = bar.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const ratio = x / rect.width;
    scrubRatioRef.current = ratio;
    setScrubPercentage(ratio * 100);

    const handlePointerMove = (e: PointerEvent) => {
      const rect = bar.getBoundingClientRect();
      const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
      const ratio = x / rect.width;
      scrubRatioRef.current = ratio;
      setScrubPercentage(ratio * 100);
    };

    const handlePointerUp = () => {
      onSeek(scrubRatioRef.current * duration);
      setScrubPercentage(null);
      bar.releasePointerCapture(e.pointerId);
      bar.removeEventListener("pointermove", handlePointerMove);
      bar.removeEventListener("pointerup", handlePointerUp);
    };

    bar.setPointerCapture(e.pointerId);
    bar.addEventListener("pointermove", handlePointerMove);
    bar.addEventListener("pointerup", handlePointerUp);
  };

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
        style={{ touchAction: "none" }}
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
