import { Crown, Heart, Play, SkipForward } from "lucide-react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import type { SongRef } from "@/core/playlist/types";
import { ncm } from "@/services/ncm";
import { usePlayerStore } from "@/stores";

interface TrackRowProps {
  track: SongRef;
  index: number;
  onPlay: (track: SongRef) => void;
  showAlbum?: boolean;
}

export function TrackRow({
  track,
  index,
  onPlay,
  showAlbum = false,
}: TrackRowProps) {
  const playNext = usePlayerStore((s) => s.playNext);

  const handlePlayNext = () => {
    playNext(track);
  };

  const handleFavorite = async () => {
    try {
      await ncm.like(track.id, true);
    } catch {
      // silently ignore
    }
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger
        className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-accent w-full text-left"
        onDoubleClick={() => onPlay(track)}
        onKeyDown={(e) => {
          if (e.key === "Enter") onPlay(track);
        }}
        role="button"
        tabIndex={0}
      >
        <span className="w-8 text-center text-xs text-muted-foreground">
          {String(index + 1).padStart(2, "0")}
        </span>
        {track.album.picUrl && (
          <img
            alt={track.album.name}
            className="h-9 w-9 shrink-0 rounded object-cover"
            src={track.album.picUrl}
          />
        )}
        <div className="flex-1 min-w-0">
          <p className="flex items-center gap-1 min-w-0 font-medium">
            <span className="truncate">{track.name}</span>
            {track.fee === 1 && (
              <Crown className="h-3.5 w-3.5 shrink-0 text-amber-400" />
            )}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {track.artists.map((a) => a.name).join("/") || "未知歌手"}
            {showAlbum && track.album.name && ` · ${track.album.name}`}
          </p>
        </div>
        <button
          className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
          onClick={(e) => {
            e.stopPropagation();
            onPlay(track);
          }}
          title="播放"
          type="button"
        >
          <Play className="h-4 w-4" />
        </button>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={() => onPlay(track)}>
          <Play className="h-4 w-4" />
          播放
        </ContextMenuItem>
        <ContextMenuItem onClick={handlePlayNext}>
          <SkipForward className="h-4 w-4" />
          下一首播放
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={handleFavorite}>
          <Heart className="h-4 w-4" />
          收藏
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
