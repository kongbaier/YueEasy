import { ChevronDown } from "lucide-react";
import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Lyrics } from "@/components/lyrics/Lyrics";
import { PlayerPageControls } from "@/components/player-page/PlayerPageControls";
import { PlayerPageProgress } from "@/components/player-page/PlayerPageProgress";
import { PlayerPageQueue } from "@/components/player-page/PlayerPageQueue";
import { PlayerPageVolume } from "@/components/player-page/PlayerPageVolume";
import { usePlayerStore } from "@/stores";

export function PlayerPage() {
  const navigate = useNavigate();
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (el) {
      requestAnimationFrame(() => {
        el.style.transform = "translateY(0)";
      });
    }
  }, []);

  const handleClose = () => {
    const el = containerRef.current;
    if (el) {
      el.style.transform = "translateY(100%)";
      setTimeout(() => navigate(-1), 300);
    } else {
      navigate(-1);
    }
  };

  if (!currentTrack) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
        <p className="text-muted-foreground">未在播放</p>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-background transition-transform duration-300 ease-in-out"
      ref={containerRef}
      style={{ transform: "translateY(100%)" }}
    >
      <div className="flex items-center justify-between px-6 py-3">
        <button
          className="rounded p-1 text-muted-foreground transition-colors hover:text-foreground"
          onClick={handleClose}
          type="button"
        >
          <ChevronDown className="size-6" />
        </button>
        <span className="text-xs text-muted-foreground">正在播放</span>
        <div className="w-8" />
      </div>

      <div className="flex-1 flex overflow-hidden px-6 pb-4">
        {/* Left: Album art + info */}
        <div className="w-80 shrink-0 flex flex-col items-center justify-center gap-4">
          <div className="w-64 h-64 rounded-xl overflow-hidden shadow-2xl">
            {currentTrack.album?.picUrl ? (
              <img
                alt={currentTrack.album.name}
                className="w-full h-full object-cover"
                src={currentTrack.album.picUrl}
              />
            ) : (
              <div className="w-full h-full bg-secondary" />
            )}
          </div>

          <div className="text-center max-w-xs">
            <h1 className="text-lg font-bold truncate">{currentTrack.name}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {currentTrack.artists?.map((a) => a.name).join(" / ")}
            </p>
            {currentTrack.album?.name && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {currentTrack.album.name}
              </p>
            )}
          </div>
        </div>

        {/* Center: Lyrics */}
        <div className="flex-1 flex flex-col justify-center min-w-0">
          <Lyrics />
        </div>

        {/* Right: Queue */}
        <div className="w-72 shrink-0 border-l border-border ml-4">
          <PlayerPageQueue />
        </div>
      </div>

      {/* Bottom: Controls */}
      <div className="px-6 pb-4 space-y-3">
        <div className="max-w-2xl mx-auto w-full">
          <PlayerPageProgress />
        </div>
        <div className="max-w-2xl mx-auto w-full">
          <PlayerPageControls />
        </div>
        <div className="max-w-2xl mx-auto w-full">
          <PlayerPageVolume />
        </div>
      </div>
    </div>
  );
}
