import { ListMusic, Play } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ImageWithFade } from "@/components/ui/image";
import { formatCount } from "@/lib/format";
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
        "group w-40 shrink-0 cursor-pointer snap-start rounded-lg bg-card text-left",
        "ring-1 ring-border/30",
        "transition-all duration-150 ease-out",
        "hover:bg-card hover:shadow-md hover:ring-border/50 hover:-translate-y-0.5",
        "lg:w-44",
        "xl:w-48",
      )}
      onClick={() => navigate(`/playlist/${playlist.id}`)}
      type="button"
    >
      <div className="relative aspect-square overflow-hidden rounded-t-lg">
        <ImageWithFade
          alt={playlist.name}
          className="object-cover transition-transform duration-300 group-hover:scale-105"
          fill
          src={playlist.coverUrl}
        />
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />
        {showPlayCount && (
          <div className="absolute left-2 bottom-2 flex items-center gap-1 text-xs text-white/80">
            <Play className="size-3 fill-white/80" />
            {formatCount(playlist.playCount)}
          </div>
        )}
      </div>
      <div className="p-2.5 space-y-1">
        <p className="truncate text-sm font-medium leading-tight">
          {playlist.name}
        </p>
        <p className="flex items-center gap-1 text-xs text-muted-foreground truncate">
          {playlist.creator ? (
            <span>{playlist.creator}</span>
          ) : (
            playlist.trackCount > 0 && (
              <>
                <ListMusic className="size-3 shrink-0" />
                <span>{playlist.trackCount} 首</span>
              </>
            )
          )}
        </p>
      </div>
    </button>
  );
};
