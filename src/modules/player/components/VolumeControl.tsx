import { Volume2, VolumeX } from 'lucide-react';
import { useRef, useState } from 'react';
import { Button } from '@/shared/ui/button';
import { usePlayer } from '@/modules/player/hooks/usePlayer';

const DELAY_MS = 200;

export const VolumeControl = () => {
  const { volume, isMuted, setVolume, setMuted } = usePlayer();

  const applyVolume = (v: number) => {
    setVolume(v);
    setMuted(false);
  };

  const applyMuted = (m: boolean) => {
    setMuted(m);
  };

  const [open, setOpen] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const handlePointerDown = (e: React.PointerEvent) => {
    const bar = barRef.current;
    if (!bar) return;
    const rect = bar.getBoundingClientRect();
    const y = Math.max(0, Math.min(rect.bottom - e.clientY, rect.height));
    const ratio = y / rect.height;
    applyVolume(ratio);

    const handlePointerMove = (e: PointerEvent) => {
      const rect = bar.getBoundingClientRect();
      const y = Math.max(0, Math.min(rect.bottom - e.clientY, rect.height));
      const ratio = y / rect.height;
      applyVolume(ratio);
    };

    const handlePointerUp = () => {
      bar.releasePointerCapture(e.pointerId);
      bar.removeEventListener('pointermove', handlePointerMove);
      bar.removeEventListener('pointerup', handlePointerUp);
    };

    bar.setPointerCapture(e.pointerId);
    bar.addEventListener('pointermove', handlePointerMove);
    bar.addEventListener('pointerup', handlePointerUp);
  };

  const toggleMute = () => applyMuted(!isMuted);

  const handleControlEnter = () => {
    clearTimeout(closeTimerRef.current);
    setOpen(true);
  };

  const handleControlLeave = () => {
    closeTimerRef.current = setTimeout(() => setOpen(false), DELAY_MS);
  };

  const handlePopupEnter = () => clearTimeout(closeTimerRef.current);

  const handlePopupLeave = () => {
    closeTimerRef.current = setTimeout(() => setOpen(false), DELAY_MS);
  };

  const displayVolume = isMuted ? 0 : volume;

  return (
    <div className="relative flex items-center">
      <div
        className="flex items-center"
        onPointerEnter={handleControlEnter}
        onPointerLeave={handleControlLeave}
      >
        <Button
          className="text-foreground hover:bg-transparent hover:text-primary"
          onClick={toggleMute}
          size="icon"
          variant="ghost"
        >
          {displayVolume === 0 ? (
            <VolumeX className="size-5" />
          ) : (
            <Volume2 className="size-5" />
          )}
        </Button>
      </div>

      {open && (
        <div
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 p-2 bg-popover border border-border rounded-lg shadow-lg dark:shadow-black/30 flex flex-col items-center gap-1.5 z-50"
          onPointerEnter={handlePopupEnter}
          onPointerLeave={handlePopupLeave}
        >
          <div
            className="w-5 h-24 cursor-pointer flex items-center justify-center"
            onPointerDown={handlePointerDown}
            ref={barRef}
            style={{ touchAction: 'none' }}
          >
            <div className="w-1 h-full bg-secondary rounded-full relative">
              <div
                className="absolute bottom-0 left-0 right-0 bg-primary rounded-full"
                style={{ height: `${displayVolume * 100}%` }}
              />
            </div>
          </div>
          <span className="text-xs text-muted-foreground tabular-nums">
            {Math.round(displayVolume * 100)}
          </span>
        </div>
      )}
    </div>
  );
};
