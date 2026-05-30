import { Volume2, VolumeX } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { usePlayerStore } from "@/stores";

export function VolumeControl() {
  const volume = usePlayerStore((s) => s.volume);
  const muted = usePlayerStore((s) => s.muted);
  const setVolume = usePlayerStore((s) => s.setVolume);
  const setMuted = usePlayerStore((s) => s.setMuted);
  const [open, setOpen] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const handlePointerDown = (e: React.PointerEvent) => {
    const bar = barRef.current;
    if (!bar) return;
    const rect = bar.getBoundingClientRect();
    const y = Math.max(0, Math.min(rect.bottom - e.clientY, rect.height));
    const ratio = y / rect.height;
    setMuted(false);
    setVolume(ratio);

    const handlePointerMove = (e: PointerEvent) => {
      const rect = bar.getBoundingClientRect();
      const y = Math.max(0, Math.min(rect.bottom - e.clientY, rect.height));
      const ratio = y / rect.height;
      setVolume(ratio);
    };

    const handlePointerUp = () => {
      bar.releasePointerCapture(e.pointerId);
      bar.removeEventListener("pointermove", handlePointerMove);
      bar.removeEventListener("pointerup", handlePointerUp);
    };

    bar.setPointerCapture(e.pointerId);
    bar.addEventListener("pointermove", handlePointerMove);
    bar.addEventListener("pointerup", handlePointerUp);
  };

  const toggleMute = () => setMuted(!muted);

  const handleControlEnter = () => {
    clearTimeout(closeTimerRef.current);
    setOpen(true);
  };

  const handleControlLeave = () => {
    closeTimerRef.current = setTimeout(() => setOpen(false), 150);
  };

  const handlePopupEnter = () => clearTimeout(closeTimerRef.current);

  const handlePopupLeave = () => {
    closeTimerRef.current = setTimeout(() => setOpen(false), 150);
  };

  const displayVolume = muted ? 0 : volume;

  return (
    <div className="relative flex items-center">
      <div
        className="flex items-center"
        onPointerEnter={handleControlEnter}
        onPointerLeave={handleControlLeave}
      >
        <Button
          className="border-none"
          onClick={toggleMute}
          size="icon-sm"
          type="button"
          variant="ghost"
        >
          {displayVolume === 0 ? (
            <VolumeX className="size-4" />
          ) : (
            <Volume2 className="size-4" />
          )}
        </Button>
      </div>

      {open && (
        <div
          className="absolute bg-background bottom-full left-1/2 -translate-x-1/2 mb-1 p-2 bg-popover border border-border rounded-lg shadow-lg flex flex-col items-center gap-1.5 z-50"
          onPointerEnter={handlePopupEnter}
          onPointerLeave={handlePopupLeave}
        >
          <div
            className="w-5 h-24 cursor-pointer flex items-center justify-center"
            onPointerDown={handlePointerDown}
            ref={barRef}
            style={{ touchAction: "none" }}
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
          <div
            className={cn(
              "absolute -bottom-1.5 left-1/2 -translate-x-1/2",
              "w-0 h-0",
              "border-l-[6px] border-r-[6px] border-t-[6px]",
              "border-l-transparent border-r-transparent",
              "border-t-popover",
            )}
          />
        </div>
      )}
    </div>
  );
}
