import { LikeButton } from '@/modules/like/components/LikeButton';
import type { Track } from '@/shared/types/player';
import { Button } from '@/shared/ui/button';
import { cn } from 'cn';
import {
  Download,
  Ellipsis,
  ListMusic,
  MessageCircleMore,
  Share2,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

export const PlayerMenu = ({
  currentTrack,
  showComments,
  showQueue,
  onToggleComments,
  onToggleQueue,
}: {
  currentTrack: Track;
  showComments: boolean;
  showQueue: boolean;
  onToggleComments: () => void;
  onToggleQueue: () => void;
}) => {
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!moreOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [moreOpen]);

  return (
    <div className="w-full shrink-0 h-1/10 flex justify-between items-center gap-1 text-foreground">
      <LikeButton track={currentTrack} size="icon-lg" />
      <Button
        className={cn(
          showComments
            ? 'text-primary hover:text-primary'
            : 'text-foreground hover:bg-transparent hover:text-primary',
        )}
        onClick={onToggleComments}
        size="icon-lg"
        variant={showComments ? 'secondary' : 'ghost'}
      >
        <MessageCircleMore className="size-5" strokeWidth={1.5} />
      </Button>
      <Button
        className={cn(
          showQueue
            ? 'text-primary hover:text-primary'
            : 'text-foreground hover:bg-transparent hover:text-primary',
        )}
        onClick={onToggleQueue}
        size="icon-lg"
        variant={showQueue ? 'secondary' : 'ghost'}
      >
        <ListMusic className="size-5" strokeWidth={1.5} />
      </Button>
      <div className="relative" ref={moreRef}>
        <Button
          onClick={() => setMoreOpen((v) => !v)}
          size="icon-lg"
          variant={moreOpen ? 'secondary' : 'ghost'}
        >
          <Ellipsis className="size-5" strokeWidth={1.5} />
        </Button>
        {moreOpen && (
          <div className="absolute bottom-full right-0 mb-1 bg-popover border border-border rounded-lg shadow-lg py-1 min-w-30 z-50">
            <Button
              className="w-full justify-start opacity-60"
              disabled
              size="sm"
              variant="ghost"
            >
              <Share2 className="size-4" />
              分享
            </Button>
            <Button
              className="w-full justify-start opacity-60"
              size="sm"
              variant="ghost"
            >
              <Download className="size-4" />
              下载
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
