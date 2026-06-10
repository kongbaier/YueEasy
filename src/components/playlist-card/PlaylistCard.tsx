import { useNavigate } from "react-router-dom";
import { ImageWithFade } from "@/components/ui/image";
import { cn } from "@/lib/utils";
import type { PlaylistDisplay } from "./PlaylistDisplay";

interface PlaylistCardProps {
  playlist: PlaylistDisplay;
  showPlayCount?: boolean;
}

export const PlaylistCard = ({
  playlist,
  showPlayCount,
}: PlaylistCardProps) => {
  const navigate = useNavigate();

  return (
    <button
      className={cn(
        "group w-30 shrink-0 cursor-pointer snap-start overflow-hidden rounded-lg bg-card text-left transition-colors hover:bg-accent",
        "lg:w-36",
        "xl:w-40",
        "2xl:w-44",
      )}
      onClick={() => navigate(`/playlist/${playlist.id}`)}
      type="button"
    >
      <div className="relative aspect-square overflow-hidden">
        <ImageWithFade
          alt={playlist.name}
          className="object-cover transition-transform group-hover:scale-105"
          fill
          src={playlist.coverUrl}
        />
        {showPlayCount && (
          <div className="absolute right-1 top-1 rounded bg-black/60 px-1.5 py-0.5 text-xs text-white">
            {playlist.playCount > 10000
              ? `${(playlist.playCount / 10000).toFixed(0)}万`
              : playlist.playCount}
          </div>
        )}
      </div>
      <div className="p-2">
        <p className="truncate text-sm">{playlist.name}</p>
      </div>
    </button>
  );
};
