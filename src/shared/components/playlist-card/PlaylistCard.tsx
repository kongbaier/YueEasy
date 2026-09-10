import { ListMusic, Play } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatCount } from '@/shared/utils/format';
import { cn } from '@/shared/utils/cn';
import { getNcmImageUrl } from '@/shared/utils/image';
import { DecodedImage } from '@/shared/ui/image';
import type { Playlist } from '@/shared/types/entities';
import { AspectRatio } from '../../ui/aspect-ratio';

interface PlaylistCardProps {
  playlist: Playlist;
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
        'group w-40 shrink-0 cursor-pointer snap-start rounded-lg bg-card text-left',
        'ring-1 ring-border/30',
        'transition-all duration-150 ease-out',
        'hover:bg-card hover:ring-border/50 hover:-translate-y-0.5',
        'lg:w-44',
        'xl:w-48',
      )}
      onClick={() => navigate(`/playlist/${playlist.id}`)}
      type="button"
    >
      <AspectRatio className="overflow-hidden rounded-t-lg" ratio={1}>
        <DecodedImage
          alt={playlist.name}
          className="object-cover transition-transform duration-300 group-hover:scale-105"
          containerClassName="h-full w-full"
          src={getNcmImageUrl(playlist.coverUrl, 200)}
        />
        <div className="absolute inset-x-0 bottom-0 z-10 h-1/2 bg-linear-to-t from-black/60 to-transparent pointer-events-none" />
        {showPlayCount && (
          <div
            className="absolute left-2 bottom-2 flex items-center gap-1 text-xs text-white z-20"
            style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.5))' }}
          >
            <Play className="size-3" />
            {formatCount(playlist.playCount)}
          </div>
        )}
      </AspectRatio>
      <div className="p-2.5 space-y-1">
        <p className="truncate text-sm font-medium leading-tight">
          {playlist.name}
        </p>
        <p className="flex items-center gap-1 text-xs text-muted-foreground truncate">
          {playlist.creator ? (
            <span>{playlist.creator.nickname}</span>
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
