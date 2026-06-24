import { Volume1, Volume2 } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { FollowTooltip } from "@/components/player/follow-tooltip";
import { usePlayerStore } from "@/stores";

const STEP = 0.1;

export const PlayerPageVolume = ({ className }: { className?: string }) => {
  const volume = usePlayerStore((s) => s.volume);
  const muted = usePlayerStore((s) => s.muted);
  const setVolume = usePlayerStore((s) => s.setVolume);
  const setMuted = usePlayerStore((s) => s.setMuted);
  const barRef = useRef<HTMLDivElement>(null);
  const [scrubVolume, setScrubVolume] = useState<number | null>(null);

  const displayVolume = muted ? 0 : (scrubVolume ?? volume);

  const [hoverBarX, setHoverBarX] = useState(0);
  const [isHovering, setIsHovering] = useState(false);

  const updateHover = useCallback((clientX: number) => {
    const bar = barRef.current;
    if (!bar) return;
    const rect = bar.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    setHoverBarX(x);
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
    setMuted(false);
    setVolume(ratio);
    setScrubVolume(ratio);

    const handlePointerMove = (e: PointerEvent) => {
      const rect = bar.getBoundingClientRect();
      const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
      const ratio = x / rect.width;
      setVolume(ratio);
      setScrubVolume(ratio);
    };

    const handlePointerUp = () => {
      setScrubVolume(null);
      bar.releasePointerCapture(e.pointerId);
      bar.removeEventListener("pointermove", handlePointerMove);
      bar.removeEventListener("pointerup", handlePointerUp);
    };

    bar.setPointerCapture(e.pointerId);
    bar.addEventListener("pointermove", handlePointerMove);
    bar.addEventListener("pointerup", handlePointerUp);
  };

  const adjustVolume = (delta: number) => {
    const { muted, volume } = usePlayerStore.getState();
    if (muted) setMuted(false);
    setVolume(Math.max(0, Math.min(1, volume + delta)));
  };

  const hoverVolume =
    barRef.current && isHovering
      ? hoverBarX / barRef.current.getBoundingClientRect().width
      : displayVolume;

  return (
    <div className={`flex items-center gap-1 ${className ?? ""}`}>
      <Button
        className="text-foreground hover:bg-transparent hover:text-primary"
        onClick={() => adjustVolume(-STEP)}
        size="icon"
        variant="ghost"
      >
        <Volume1 className="size-4" />
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
          style={{ touchAction: "none" }}
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
        <Volume2 className="size-4" />
      </Button>

      <FollowTooltip anchorRef={barRef} open={isHovering} x={hoverBarX}>
        <span className="inline-block min-w-[3ch] text-center">
          {Math.round(hoverVolume * 100)}
        </span>
      </FollowTooltip>
    </div>
  );
};
