import { Volume1, Volume2 } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';
import { Button } from '@/shared/ui/button';
import { FollowTooltip } from '@/modules/player/components/FollowTooltip';
import { usePlayer } from '@/modules/player/hooks/usePlayer';

const STEP = 0.1;

export const PlayerPageVolume = ({ className }: { className?: string }) => {
  const { volume, isMuted, setVolume, setMuted } = usePlayer();

  const applyVolume = (v: number) => {
    setVolume(v);
    setMuted(false);
  };

  const barRef = useRef<HTMLDivElement>(null);
  const [scrubVolume, setScrubVolume] = useState<number | null>(null);
  const [hoverVolume, setHoverVolume] = useState(0);

  const displayVolume = isMuted ? 0 : (scrubVolume ?? volume);

  const [hoverBarX, setHoverBarX] = useState(0);
  const [isHovering, setIsHovering] = useState(false);

  const updateHover = useCallback((clientX: number) => {
    const bar = barRef.current;
    if (!bar) return;
    const rect = bar.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    setHoverBarX(x);
    setHoverVolume(x / rect.width);
    setIsHovering(true);
  }, []);

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      updateHover(e.clientX);
    },
    [updateHover],
  );

  const handlePointerLeave = useCallback(() => {
    setIsHovering(false);
  }, []);

  const handlePointerDown = (e: React.PointerEvent) => {
    const bar = barRef.current;
    if (!bar) return;
    const rect = bar.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const ratio = x / rect.width;
    applyVolume(ratio);
    setScrubVolume(ratio);

    const handleDragMove = (moveEvent: PointerEvent) => {
      const dragRect = bar.getBoundingClientRect();
      const dragX = Math.max(
        0,
        Math.min(moveEvent.clientX - dragRect.left, dragRect.width),
      );
      const dragRatio = dragX / dragRect.width;
      applyVolume(dragRatio);
      setScrubVolume(dragRatio);
    };

    const handlePointerUp = () => {
      setScrubVolume(null);
      bar.releasePointerCapture(e.pointerId);
      bar.removeEventListener('pointermove', handleDragMove);
      bar.removeEventListener('pointerup', handlePointerUp);
    };

    bar.setPointerCapture(e.pointerId);
    bar.addEventListener('pointermove', handleDragMove);
    bar.addEventListener('pointerup', handlePointerUp);
  };

  const adjustVolume = (delta: number) => {
    const next = Math.max(0, Math.min(1, volume + delta));
    applyVolume(next);
  };

  return (
    <div className={`flex items-center gap-1 ${className ?? ''}`}>
      <Button
        className="text-foreground hover:bg-transparent hover:text-primary"
        onClick={() => adjustVolume(-STEP)}
        size="icon"
        variant="ghost"
      >
        <Volume1 className="size-5" />
      </Button>
      <div
        className="flex-1 h-5 cursor-pointer flex items-center"
        onPointerDown={handlePointerDown}
        onPointerLeave={handlePointerLeave}
        onPointerMove={handlePointerMove}
      >
        <div
          className="w-full h-1 bg-secondary rounded-full relative select-none"
          ref={barRef}
          style={{ touchAction: 'none' }}
        >
          <div
            className="h-full bg-primary rounded-full"
            style={{ width: `${displayVolume * 100}%` }}
          />
        </div>
      </div>
      <Button
        className="text-foreground hover:bg-transparent hover:text-primary"
        onClick={() => adjustVolume(STEP)}
        size="icon"
        variant="ghost"
      >
        <Volume2 className="size-5" />
      </Button>

      <FollowTooltip anchorRef={barRef} open={isHovering} x={hoverBarX}>
        <span className="inline-block min-w-[3ch] text-center">
          {Math.round(hoverVolume * 100)}
        </span>
      </FollowTooltip>
    </div>
  );
};
