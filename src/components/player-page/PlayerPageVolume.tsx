import { Volume2, VolumeX } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { usePlayerStore } from "@/stores";

export function PlayerPageVolume({ className }: { className?: string }) {
  const volume = usePlayerStore((s) => s.volume);
  const muted = usePlayerStore((s) => s.muted);
  const setVolume = usePlayerStore((s) => s.setVolume);
  const setMuted = usePlayerStore((s) => s.setMuted);
  const barRef = useRef<HTMLDivElement>(null);
  const [scrubVolume, setScrubVolume] = useState<number | null>(null);

  const displayVolume = muted ? 0 : (scrubVolume ?? volume);

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

  const toggleMute = () => setMuted(!muted);

  return (
    <div className={`flex items-center gap-1 ${className ?? ""}`}>
      <Button
        className="text-foreground hover:bg-transparent hover:text-primary"
        onClick={toggleMute}
        size="icon"
        variant="ghost"
      >
        <VolumeX className="size-4" />
      </Button>
      <div
        className="flex-1 h-5 cursor-pointer flex items-center"
        onPointerDown={handlePointerDown}
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
        onClick={toggleMute}
        size="icon"
        variant="ghost"
      >
        <Volume2 className="size-4" />
      </Button>
    </div>
  );
}
